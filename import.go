package main

import (
	"archive/tar"
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

type profileConfig struct {
	Version          int    `json:"version"`
	CurrentProfileID string `json:"currentProfileId"`
	Profiles         []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"profiles"`
}

func discoverJoplinProfile() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	candidates := []string{
		filepath.Join(home, ".config", "joplin-desktop"),
		filepath.Join(os.Getenv("APPDATA"), "joplin-desktop"),
		filepath.Join(os.Getenv("APPDATA"), "Joplin"),
	}
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if resolved, err := normalizeJoplinProfilePath(candidate); err == nil {
			return resolved
		}
	}
	return ""
}

func normalizeJoplinProfilePath(input string) (string, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return "", errors.New("未指定 Joplin profile")
	}
	path, err := filepath.Abs(input)
	if err != nil {
		return "", err
	}
	if stat, err := os.Stat(path); err == nil && !stat.IsDir() {
		if strings.EqualFold(filepath.Base(path), "profiles.json") {
			path = filepath.Dir(path)
		} else if strings.EqualFold(filepath.Base(path), "database.sqlite") {
			path = filepath.Dir(path)
		} else {
			return "", fmt.Errorf("不是可辨識的 Joplin profile 路徑: %s", path)
		}
	}
	if fileExists(filepath.Join(path, "database.sqlite")) {
		return path, nil
	}
	configPath := filepath.Join(path, "profiles.json")
	if fileExists(configPath) {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return "", err
		}
		var config profileConfig
		if err := json.Unmarshal(data, &config); err != nil {
			return "", fmt.Errorf("讀取 profiles.json: %w", err)
		}
		if config.CurrentProfileID != "" && config.CurrentProfileID != "default" {
			path = filepath.Join(path, "profile-"+config.CurrentProfileID)
			if fileExists(filepath.Join(path, "database.sqlite")) {
				return path, nil
			}
		}
	}
	return "", fmt.Errorf("找不到 Joplin database.sqlite: %s", path)
}

func fileExists(path string) bool {
	stat, err := os.Stat(path)
	return err == nil && !stat.IsDir()
}

func joplinProfileDisplayName(profilePath string) string {
	configRoot := profilePath
	if strings.HasPrefix(strings.ToLower(filepath.Base(profilePath)), "profile-") {
		configRoot = filepath.Dir(profilePath)
	}
	data, err := os.ReadFile(filepath.Join(configRoot, "profiles.json"))
	if err == nil {
		var config profileConfig
		if json.Unmarshal(data, &config) == nil {
			for _, profile := range config.Profiles {
				if profile.ID == config.CurrentProfileID && strings.TrimSpace(profile.Name) != "" {
					return strings.TrimSpace(profile.Name)
				}
			}
		}
	}
	name := filepath.Base(profilePath)
	if name == "." || name == "" {
		return "Joplin"
	}
	return name
}

func inspectJoplinProfile(profilePath string) (JoplinProfilePreview, error) {
	preview := JoplinProfilePreview{
		Available:   true,
		ProfilePath: profilePath,
		DisplayName: joplinProfileDisplayName(profilePath),
	}
	source, err := openReadOnlySQLite(filepath.Join(profilePath, "database.sqlite"))
	if err != nil {
		preview.Available = false
		preview.Error = err.Error()
		return preview, err
	}
	defer source.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := source.QueryRowContext(ctx, `SELECT COUNT(*) FROM folders`).Scan(&preview.Notebooks); err != nil {
		preview.Available = false
		preview.Error = err.Error()
		return preview, err
	}
	noteColumns, err := tableColumns(ctx, source, "notes")
	if err != nil {
		preview.Available = false
		preview.Error = err.Error()
		return preview, err
	}
	deletedExpression := columnExpression(noteColumns, "deleted_time", "0")
	if err := source.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM notes WHERE `+deletedExpression+` = 0`,
	).Scan(&preview.Notes); err != nil {
		preview.Available = false
		preview.Error = err.Error()
		return preview, err
	}
	encryptedConditions := make([]string, 0, 2)
	for _, column := range []string{"encryption_applied", "is_locked"} {
		if noteColumns[column] {
			encryptedConditions = append(encryptedConditions, `"`+column+`" = 1`)
		}
	}
	if len(encryptedConditions) > 0 {
		if err := source.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM notes WHERE `+deletedExpression+` = 0 AND (`+strings.Join(encryptedConditions, " OR ")+`)`,
		).Scan(&preview.EncryptedNotes); err != nil {
			preview.Available = false
			preview.Error = err.Error()
			return preview, err
		}
	}
	if tableExists(ctx, source, "resources") {
		if err := source.QueryRowContext(ctx, `SELECT COUNT(*) FROM resources`).Scan(&preview.Resources); err != nil {
			preview.Available = false
			preview.Error = err.Error()
			return preview, err
		}
	}
	return preview, nil
}

func openReadOnlySQLite(path string) (*sql.DB, error) {
	slashed := filepath.ToSlash(path)
	if !strings.HasPrefix(slashed, "/") {
		slashed = "/" + slashed
	}
	dsn := (&url.URL{Scheme: "file", Path: slashed}).String() + "?mode=ro"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`PRAGMA query_only = ON`); err != nil {
		db.Close()
		return nil, fmt.Errorf("設定來源資料庫唯讀失敗: %w", err)
	}
	return db, nil
}

func importJoplinProfile(ctx context.Context, store *Store, profilePath string, progress func(float64, string)) (ImportReport, error) {
	report := ImportReport{
		Source: profilePath, Kind: "joplin-profile", DestinationFolder: filepath.Base(profilePath),
		Warnings: make([]ImportWarning, 0), EncryptedSkipped: make([]string, 0),
	}
	if progress == nil {
		progress = func(float64, string) {}
	}
	progress(0.02, "以唯讀模式開啟 Joplin 資料庫")
	source, err := openReadOnlySQLite(filepath.Join(profilePath, "database.sqlite"))
	if err != nil {
		return report, err
	}
	defer source.Close()

	for _, table := range []string{"folders", "notes"} {
		var count int
		err := source.QueryRowContext(ctx, `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?`, table).Scan(&count)
		if err != nil || count == 0 {
			return report, fmt.Errorf("不是可支援的 Joplin 資料庫，缺少 %s 資料表", table)
		}
	}

	tx, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return report, err
	}
	defer tx.Rollback()

	folderColumns, err := tableColumns(ctx, source, "folders")
	if err != nil {
		return report, err
	}
	progress(0.08, "匯入筆記本")
	folderRows, err := source.QueryContext(ctx,
		`SELECT id, parent_id, title, created_time, updated_time FROM folders`,
	)
	if err != nil {
		return report, err
	}
	for folderRows.Next() {
		var id, parentID, title string
		var created, updated int64
		if err := folderRows.Scan(&id, &parentID, &title, &created, &updated); err != nil {
			folderRows.Close()
			return report, err
		}
		result, err := tx.ExecContext(ctx,
			`INSERT INTO notebooks(id,parent_id,title,icon,sort_order,created_at,updated_at)
			 VALUES(?,?,?,?,0,?,?)
			 ON CONFLICT(id) DO NOTHING`,
			id, parentID, title, "", created, updated,
		)
		if err != nil {
			folderRows.Close()
			return report, err
		}
		if changed, _ := result.RowsAffected(); changed > 0 {
			report.Notebooks++
		}
	}
	folderRows.Close()
	if err := folderRows.Err(); err != nil {
		return report, err
	}
	_ = folderColumns

	noteColumns, err := tableColumns(ctx, source, "notes")
	if err != nil {
		return report, err
	}
	deletedExpr := columnExpression(noteColumns, "deleted_time", "0")
	isTodoExpr := columnExpression(noteColumns, "is_todo", "0")
	todoDueExpr := columnExpression(noteColumns, "todo_due", "0")
	todoCompletedExpr := columnExpression(noteColumns, "todo_completed", "0")
	isConflictExpr := columnExpression(noteColumns, "is_conflict", "0")
	authorExpr := columnExpression(noteColumns, "author", "''")
	sourceURLExpr := columnExpression(noteColumns, "source_url", "''")
	encryptedExpr := columnExpression(noteColumns, "encryption_applied", "0")
	lockedExpr := columnExpression(noteColumns, "is_locked", "0")

	progress(0.22, "匯入筆記")
	noteRows, err := source.QueryContext(ctx,
		`SELECT id,parent_id,title,body,created_time,updated_time,`+
			deletedExpr+`,`+isTodoExpr+`,`+todoDueExpr+`,`+todoCompletedExpr+`,`+
			isConflictExpr+`,`+authorExpr+`,`+sourceURLExpr+`,`+encryptedExpr+`,`+lockedExpr+`
		 FROM notes`,
	)
	if err != nil {
		return report, err
	}
	resourceNoteIDs := map[string]string{}
	for noteRows.Next() {
		var id, parentID, title, body, author, sourceURL string
		var created, updated, deleted, todoDue, todoCompleted int64
		var isTodo, isConflict, encrypted, locked int
		if err := noteRows.Scan(
			&id, &parentID, &title, &body, &created, &updated, &deleted,
			&isTodo, &todoDue, &todoCompleted, &isConflict, &author, &sourceURL, &encrypted, &locked,
		); err != nil {
			noteRows.Close()
			return report, err
		}
		if encrypted != 0 || locked != 0 || (body == "" && strings.Contains(title, "encrypted")) {
			report.Skipped++
			report.EncryptedSkipped = append(report.EncryptedSkipped, title)
			continue
		}
		var folderExists int
		_ = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM notebooks WHERE id=?`, parentID).Scan(&folderExists)
		if folderExists == 0 {
			parentID = defaultNotebookID(ctx, tx)
		}
		result, err := tx.ExecContext(ctx,
			`INSERT INTO notes(id,notebook_id,title,body,is_todo,todo_due,todo_completed,source_url,
			 author,is_conflict,sort_order,created_at,updated_at,deleted_at)
			 VALUES(?,?,?,?,?,?,?,?,?,?,0,?,?,?)
			 ON CONFLICT(id) DO NOTHING`,
			id, parentID, title, body, isTodo, todoDue, todoCompleted, sourceURL,
			author, isConflict, created, updated, deleted,
		)
		if err != nil {
			noteRows.Close()
			return report, err
		}
		if changed, _ := result.RowsAffected(); changed > 0 {
			report.Notes++
			for _, resourceID := range internalResourcePattern.FindAllString(body, -1) {
				resourceNoteIDs[strings.TrimPrefix(resourceID, ":/")] = id
			}
		}
	}
	noteRows.Close()
	if err := noteRows.Err(); err != nil {
		return report, err
	}

	progress(0.42, "匯入標籤")
	if tableExists(ctx, source, "tags") && tableExists(ctx, source, "note_tags") {
		tagIDMap := map[string]string{}
		tagRows, err := source.QueryContext(ctx, `SELECT id,title,created_time,updated_time FROM tags`)
		if err != nil {
			return report, err
		}
		for tagRows.Next() {
			var id, title string
			var created, updated int64
			if err := tagRows.Scan(&id, &title, &created, &updated); err != nil {
				tagRows.Close()
				return report, err
			}
			title = strings.TrimSpace(title)
			var existingID string
			lookupErr := tx.QueryRowContext(ctx,
				`SELECT id FROM tags WHERE id = ? OR title = ? COLLATE NOCASE LIMIT 1`,
				id, title,
			).Scan(&existingID)
			if lookupErr == nil {
				tagIDMap[id] = existingID
				continue
			}
			if !errors.Is(lookupErr, sql.ErrNoRows) {
				tagRows.Close()
				return report, lookupErr
			}
			result, err := tx.ExecContext(ctx,
				`INSERT INTO tags(id,title,created_at,updated_at) VALUES(?,?,?,?)
				 ON CONFLICT DO NOTHING`,
				id, title, created, updated,
			)
			if err != nil {
				tagRows.Close()
				return report, err
			}
			if changed, _ := result.RowsAffected(); changed > 0 {
				report.Tags++
				tagIDMap[id] = id
				continue
			}
			if err := tx.QueryRowContext(ctx,
				`SELECT id FROM tags WHERE id = ? OR title = ? COLLATE NOCASE LIMIT 1`,
				id, title,
			).Scan(&existingID); err != nil {
				tagRows.Close()
				return report, err
			}
			tagIDMap[id] = existingID
		}
		tagRows.Close()

		noteTagRows, err := source.QueryContext(ctx, `SELECT note_id,tag_id,created_time FROM note_tags`)
		if err != nil {
			return report, err
		}
		for noteTagRows.Next() {
			var noteID, tagID string
			var created int64
			if err := noteTagRows.Scan(&noteID, &tagID, &created); err != nil {
				noteTagRows.Close()
				return report, err
			}
			if mappedID, exists := tagIDMap[tagID]; exists {
				tagID = mappedID
			}
			_, _ = tx.ExecContext(ctx,
				`INSERT OR IGNORE INTO note_tags(note_id,tag_id,created_at)
				 SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM notes WHERE id=?)
				 AND EXISTS(SELECT 1 FROM tags WHERE id=?)`,
				noteID, tagID, created, noteID, tagID,
			)
		}
		noteTagRows.Close()
	}

	progress(0.58, "複製附件")
	if tableExists(ctx, source, "resources") {
		resourceColumns, _ := tableColumns(ctx, source, "resources")
		sizeExpr := columnExpression(resourceColumns, "size", "-1")
		resourceRows, err := source.QueryContext(ctx,
			`SELECT id,title,mime,filename,file_extension,`+sizeExpr+`,created_time,updated_time FROM resources`,
		)
		if err != nil {
			return report, err
		}
		for resourceRows.Next() {
			var id, title, mime, filename, extension string
			var size, created, updated int64
			if err := resourceRows.Scan(&id, &title, &mime, &filename, &extension, &size, &created, &updated); err != nil {
				resourceRows.Close()
				return report, err
			}
			sourcePath := filepath.Join(profilePath, "resources", id)
			if extension != "" {
				sourcePath += "." + extension
			}
			if stat, err := os.Stat(sourcePath); err != nil || stat.IsDir() {
				report.Warnings = append(report.Warnings, ImportWarning{Item: id, Message: "找不到附件檔案"})
				continue
			}
			dest := store.resourcePath(id)
			if !fileExists(dest) {
				if err := copyFile(sourcePath, dest); err != nil {
					report.Warnings = append(report.Warnings, ImportWarning{Item: id, Message: err.Error()})
					continue
				}
			}
			if size < 0 {
				if stat, err := os.Stat(dest); err == nil {
					size = stat.Size()
				}
			}
			storedFilename := normalizeResourceFilename(filename, title, mime, extension)
			result, err := tx.ExecContext(ctx,
				`INSERT INTO resources(id,note_id,title,mime,filename,file_size,created_at,updated_at)
				 VALUES(?,?,?,?,?,?,?,?)
				 ON CONFLICT(id) DO NOTHING`,
				id, resourceNoteIDs[id], title, mime, storedFilename, size, created, updated,
			)
			if err != nil {
				resourceRows.Close()
				return report, err
			}
			if changed, _ := result.RowsAffected(); changed > 0 {
				report.Resources++
			}
		}
		resourceRows.Close()
	}

	progress(0.78, "整理搜尋索引")
	if err := rebuildFTS(ctx, tx); err != nil {
		return report, err
	}
	if tableExists(ctx, source, "settings") {
		if err := importSafeSettings(ctx, source, tx); err != nil {
			report.Warnings = append(report.Warnings, ImportWarning{Item: "settings", Message: err.Error()})
		}
	}
	if err := tx.Commit(); err != nil {
		return report, err
	}
	if store != nil {
		// The report is persisted after the successful transaction.
		data, _ := json.Marshal(report)
		_, _ = store.db.ExecContext(ctx,
			`INSERT INTO import_jobs(id,source,kind,report_json,created_at) VALUES(?,?,?,?,?)`,
			newID(), report.Source, report.Kind, string(data), nowMillis(),
		)
	}
	progress(1, "匯入完成")
	return report, nil
}

func importSafeSettings(ctx context.Context, source *sql.DB, tx *sql.Tx) error {
	allowed := []string{
		"theme",
		"locale",
		"editor.codeView",
		"noteVisiblePanes",
		"notes.sortOrder.field",
		"notes.sortOrder.reverse",
		"windowContentZoomFactor",
	}
	args := make([]any, 0, len(allowed))
	for _, key := range allowed {
		args = append(args, key)
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(allowed)), ",")
	rows, err := source.QueryContext(ctx,
		`SELECT key,value FROM settings WHERE key IN (`+placeholders+`)`, args...,
	)
	if err != nil {
		return err
	}
	defer rows.Close()
	settings := map[string]string{}
	for rows.Next() {
		var key string
		var value any
		if err := rows.Scan(&key, &value); err != nil {
			return err
		}
		switch typed := value.(type) {
		case []byte:
			settings[key] = string(typed)
		case string:
			settings[key] = typed
		case nil:
			settings[key] = ""
		default:
			settings[key] = fmt.Sprint(typed)
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if value, ok := settings["theme"]; ok {
		clean := strings.Trim(strings.TrimSpace(value), `"`)
		switch clean {
		case "1":
			settings["theme"] = "light"
		case "2", "3", "4", "5", "6", "7", "8", "9":
			settings["theme"] = "dark"
		case "light", "dark":
			settings["theme"] = clean
		default:
			delete(settings, "theme")
		}
	}
	now := nowMillis()
	for key, value := range settings {
		_, err := tx.ExecContext(ctx,
			`INSERT INTO settings(key,value,updated_at) VALUES(?,?,?)
			 ON CONFLICT(key) DO NOTHING`,
			key, value, now,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func defaultNotebookID(ctx context.Context, tx *sql.Tx) string {
	var id string
	if err := tx.QueryRowContext(ctx, `SELECT id FROM notebooks ORDER BY created_at LIMIT 1`).Scan(&id); err == nil {
		return id
	}
	return ""
}

func tableExists(ctx context.Context, db *sql.DB, table string) bool {
	var count int
	_ = db.QueryRowContext(ctx, `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?`, table).Scan(&count)
	return count > 0
}

func tableColumns(ctx context.Context, db *sql.DB, table string) (map[string]bool, error) {
	rows, err := db.QueryContext(ctx, `PRAGMA table_info("`+strings.ReplaceAll(table, `"`, `""`)+`")`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	columns := map[string]bool{}
	for rows.Next() {
		var index, notNull, primaryKey int
		var name, fieldType string
		var defaultValue any
		if err := rows.Scan(&index, &name, &fieldType, &notNull, &defaultValue, &primaryKey); err != nil {
			return nil, err
		}
		columns[name] = true
	}
	return columns, rows.Err()
}

func columnExpression(columns map[string]bool, column string, fallback string) string {
	if columns[column] {
		return `"` + column + `"`
	}
	return fallback
}

func rebuildFTS(ctx context.Context, tx *sql.Tx) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM notes_fts`); err != nil {
		return err
	}
	rows, err := tx.QueryContext(ctx, `SELECT id,title,body FROM notes`)
	if err != nil {
		return err
	}
	defer rows.Close()
	type ftsItem struct {
		id, title, body string
	}
	items := make([]ftsItem, 0)
	for rows.Next() {
		var item ftsItem
		if err := rows.Scan(&item.id, &item.title, &item.body); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, item := range items {
		if _, err := tx.ExecContext(ctx, `INSERT INTO notes_fts(note_id,title,body) VALUES(?,?,?)`, item.id, item.title, item.body); err != nil {
			return err
		}
	}
	return nil
}

func importArchive(ctx context.Context, store *Store, sourcePath string, destinationNotebookID string, progress func(float64, string)) (ImportReport, error) {
	extension := strings.ToLower(filepath.Ext(sourcePath))
	switch extension {
	case ".jex":
		return importJEX(ctx, store, sourcePath, destinationNotebookID, progress)
	case ".enex":
		return importENEX(ctx, store, sourcePath, destinationNotebookID, progress)
	case ".md", ".markdown":
		return importMarkdownFile(ctx, store, sourcePath, destinationNotebookID)
	default:
		return ImportReport{}, fmt.Errorf("不支援的檔案格式: %s", extension)
	}
}

type rawItem struct {
	Name  string
	Type  int
	Title string
	Body  string
	Props map[string]string
}

func parseRawItem(content string) (rawItem, error) {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.TrimRight(content, "\n")
	lines := strings.Split(content, "\n")
	output := rawItem{Props: map[string]string{}}
	propertyStart := len(lines)
	for index := len(lines) - 1; index >= 0; index-- {
		line := strings.TrimSpace(lines[index])
		if line == "" {
			propertyStart = index + 1
			break
		}
		separator := strings.Index(line, ":")
		if separator < 1 {
			return output, fmt.Errorf("invalid property: %s", line)
		}
		output.Props[strings.TrimSpace(line[:separator])] = strings.TrimSpace(line[separator+1:])
	}
	typeValue, err := strconv.Atoi(output.Props["type_"])
	if err != nil {
		return output, fmt.Errorf("missing type_: %w", err)
	}
	output.Type = typeValue
	prefix := lines[:max(0, propertyStart-1)]
	if len(prefix) > 0 {
		output.Title = prefix[0]
	}
	if output.Type == 1 && len(prefix) > 2 {
		output.Body = strings.Join(prefix[2:], "\n")
	}
	for key, value := range output.Props {
		value = strings.ReplaceAll(value, `\n`, "\n")
		value = strings.ReplaceAll(value, `\r`, "\r")
		output.Props[key] = value
	}
	return output, nil
}

func importJEX(ctx context.Context, store *Store, sourcePath string, destinationNotebookID string, progress func(float64, string)) (ImportReport, error) {
	if progress == nil {
		progress = func(float64, string) {}
	}
	report := ImportReport{Source: sourcePath, Kind: "jex", Warnings: make([]ImportWarning, 0), EncryptedSkipped: make([]string, 0)}
	if destinationNotebookID != "" {
		destination, err := store.getNotebook(ctx, destinationNotebookID)
		if err != nil {
			return report, errors.New("目的筆記本不存在")
		}
		report.DestinationFolder = destination.Title
	}
	progress(0.05, "讀取 JEX 封存")
	file, err := os.Open(sourcePath)
	if err != nil {
		return report, err
	}
	defer file.Close()
	reader := tar.NewReader(file)
	items := make([]rawItem, 0)
	resourceFiles := map[string][]byte{}
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return report, fmt.Errorf("JEX 損壞: %w", err)
		}
		if header.Typeflag != tar.TypeReg || header.Size > 256*1024*1024 {
			continue
		}
		name := filepath.ToSlash(header.Name)
		if strings.Contains(name, "..") || strings.HasPrefix(name, "/") {
			report.Warnings = append(report.Warnings, ImportWarning{Item: name, Message: "略過不安全路徑"})
			continue
		}
		data, err := io.ReadAll(io.LimitReader(reader, 256*1024*1024))
		if err != nil {
			return report, err
		}
		if strings.HasPrefix(name, "resources/") {
			resourceFiles[strings.TrimPrefix(name, "resources/")] = data
			continue
		}
		if !strings.HasSuffix(strings.ToLower(name), ".md") {
			continue
		}
		item, err := parseRawItem(string(data))
		if err != nil {
			report.Warnings = append(report.Warnings, ImportWarning{Item: name, Message: err.Error()})
			continue
		}
		item.Name = name
		items = append(items, item)
	}

	progress(0.35, "建立 JEX 項目")
	tx, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return report, err
	}
	defer tx.Rollback()
	idMap := map[string]string{}
	for _, item := range items {
		if oldID := item.Props["id"]; oldID != "" {
			idMap[strings.ToLower(oldID)] = newID()
		}
	}

	// Folders first to satisfy foreign keys.
	for _, item := range items {
		if item.Type != 2 {
			continue
		}
		oldID := item.Props["id"]
		if isJoplinID(oldID) {
			idMap[strings.ToLower(oldID)] = oldID
		}
		parentID := mapParentID(idMap, item.Props["parent_id"], destinationNotebookID)
		id := mapID(idMap, oldID)
		created := parseJoplinTime(item.Props["created_time"])
		updated := parseJoplinTime(item.Props["updated_time"])
		if id == "" {
			continue
		}
		result, err := tx.ExecContext(ctx,
			`INSERT INTO notebooks(id,parent_id,title,icon,sort_order,created_at,updated_at)
			 VALUES(?,?,?,?,0,?,?) ON CONFLICT(id) DO NOTHING`,
			id, parentID, fallbackString(item.Title, "匯入筆記本"), "", created, updated,
		)
		if err != nil {
			report.Warnings = append(report.Warnings, ImportWarning{Item: item.Name, Message: err.Error()})
			continue
		}
		if changed, _ := result.RowsAffected(); changed > 0 {
			report.Notebooks++
		}
	}

	// Resources must exist before notes so image links can resolve immediately.
	for _, item := range items {
		if item.Type != 3 {
			continue
		}
		oldID := item.Props["id"]
		id := mapID(idMap, oldID)
		extension := item.Props["file_extension"]
		var data []byte
		for resourceName, resourceData := range resourceFiles {
			if strings.HasPrefix(resourceName, oldID+".") || resourceName == oldID {
				data = resourceData
				if extension == "" {
					extension = strings.TrimPrefix(filepath.Ext(resourceName), ".")
				}
				break
			}
		}
		if len(data) == 0 {
			report.Warnings = append(report.Warnings, ImportWarning{Item: oldID, Message: "JEX 附件內容不存在"})
			continue
		}
		if id == "" || id == oldID {
			id = newID()
			idMap[strings.ToLower(oldID)] = id
		}
		if err := os.WriteFile(store.resourcePath(id), data, 0o644); err != nil {
			report.Warnings = append(report.Warnings, ImportWarning{Item: oldID, Message: err.Error()})
			continue
		}
		created := parseJoplinTime(item.Props["created_time"])
		updated := parseJoplinTime(item.Props["updated_time"])
		storedFilename := normalizeResourceFilename(item.Props["filename"], item.Title, item.Props["mime"], extension)
		_, err := tx.ExecContext(ctx,
			`INSERT INTO resources(id,note_id,title,mime,filename,file_size,created_at,updated_at)
			 VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
			id, "", fallbackString(item.Title, oldID), fallbackString(item.Props["mime"], "application/octet-stream"),
			storedFilename, int64(len(data)), created, updated,
		)
		if err == nil {
			report.Resources++
		}
	}

	// Tags are resolved before notes and note-tag links so external JEX files are
	// independent of the order in which their tar entries were written.
	for _, item := range items {
		if item.Type != 4 {
			continue
		}
		oldID := item.Props["id"]
		title := fallbackString(item.Title, "未命名標籤")
		var existing string
		if err := tx.QueryRowContext(ctx, `SELECT id FROM tags WHERE title=? COLLATE NOCASE`, title).Scan(&existing); err == nil {
			idMap[strings.ToLower(oldID)] = existing
			continue
		}
		id := mapID(idMap, oldID)
		if id == "" {
			id = newID()
			idMap[strings.ToLower(oldID)] = id
		}
		_, err := tx.ExecContext(ctx,
			`INSERT INTO tags(id,title,created_at,updated_at) VALUES(?,?,?,?)`,
			id, title, parseJoplinTime(item.Props["created_time"]), parseJoplinTime(item.Props["updated_time"]),
		)
		if err != nil {
			report.Warnings = append(report.Warnings, ImportWarning{Item: item.Name, Message: err.Error()})
		} else {
			report.Tags++
		}
	}

	pendingNoteTags := make([]rawItem, 0)
	for _, item := range items {
		switch item.Type {
		case 1:
			oldID := item.Props["id"]
			id := mapID(idMap, oldID)
			if id == "" {
				id = newID()
				idMap[strings.ToLower(oldID)] = id
			}
			parentID := mapID(idMap, item.Props["parent_id"])
			if parentID == "" {
				if destinationNotebookID != "" {
					parentID = destinationNotebookID
				} else {
					parentID = defaultNotebookID(ctx, tx)
				}
			}
			body := remapJoplinLinks(item.Body, idMap)
			created := parseJoplinTime(item.Props["created_time"])
			updated := parseJoplinTime(item.Props["updated_time"])
			deleted := parseJoplinTime(item.Props["deleted_time"])
			isTodo := parseBoolProp(item.Props["is_todo"])
			todoDue := parseJoplinTime(item.Props["todo_due"])
			todoCompleted := parseJoplinTime(item.Props["todo_completed"])
			result, err := tx.ExecContext(ctx,
				`INSERT INTO notes(id,notebook_id,title,body,is_todo,todo_due,todo_completed,source_url,
				 author,is_conflict,sort_order,created_at,updated_at,deleted_at)
				 VALUES(?,?,?,?,?,?,?,?,?,?,0,?,?,?) ON CONFLICT(id) DO NOTHING`,
				id, parentID, fallbackString(item.Title, "未命名筆記"), body, boolInt(isTodo), todoDue,
				todoCompleted, item.Props["source_url"], item.Props["author"],
				parseBoolProp(item.Props["is_conflict"]), created, updated, deleted,
			)
			if err != nil {
				report.Warnings = append(report.Warnings, ImportWarning{Item: item.Name, Message: err.Error()})
			} else if changed, _ := result.RowsAffected(); changed > 0 {
				report.Notes++
				for _, resourceID := range internalResourcePattern.FindAllString(body, -1) {
					_, _ = tx.ExecContext(ctx, `UPDATE resources SET note_id=? WHERE id=?`, id, strings.TrimPrefix(resourceID, ":/"))
				}
			}
		case 5:
			pendingNoteTags = append(pendingNoteTags, item)
		}
	}
	for _, item := range pendingNoteTags {
		noteID := mapID(idMap, item.Props["note_id"])
		tagID := mapID(idMap, item.Props["tag_id"])
		if noteID != "" && tagID != "" {
			_, _ = tx.ExecContext(ctx,
				`INSERT OR IGNORE INTO note_tags(note_id,tag_id,created_at) VALUES(?,?,?)`,
				noteID, tagID, parseJoplinTime(item.Props["created_time"]),
			)
		}
	}
	if err := rebuildFTS(ctx, tx); err != nil {
		return report, err
	}
	if err := tx.Commit(); err != nil {
		return report, err
	}
	progress(1, "JEX 匯入完成")
	return report, nil
}

func isJoplinID(value string) bool {
	if len(value) != 32 {
		return false
	}
	for _, char := range value {
		if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')) {
			return false
		}
	}
	return true
}

func mapID(values map[string]string, id string) string {
	if id == "" {
		return ""
	}
	if mapped, ok := values[strings.ToLower(id)]; ok {
		return mapped
	}
	return id
}

func mapParentID(values map[string]string, id string, fallback string) string {
	if id == "" {
		return fallback
	}
	if mapped, ok := values[strings.ToLower(id)]; ok {
		return mapped
	}
	return fallback
}

func remapJoplinLinks(body string, values map[string]string) string {
	return internalResourcePattern.ReplaceAllStringFunc(body, func(value string) string {
		return ":/" + mapID(values, strings.TrimPrefix(value, ":/"))
	})
}

func parseJoplinTime(value string) int64 {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	if parsed, err := strconv.ParseInt(value, 10, 64); err == nil {
		return parsed
	}
	layouts := []string{"2006-01-02T15:04:05.000Z", time.RFC3339Nano, time.RFC3339}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.UnixMilli()
		}
	}
	return 0
}

func parseBoolProp(value string) bool {
	return value == "1" || strings.EqualFold(value, "true")
}

func fallbackString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

type enexExport struct {
	Notes []enexNote `xml:"note"`
}

type enexNote struct {
	Title     string         `xml:"title"`
	Content   string         `xml:"content"`
	Created   string         `xml:"created"`
	Updated   string         `xml:"updated"`
	Tags      []string       `xml:"tag"`
	Resources []enexResource `xml:"resource"`
}

type enexResource struct {
	Data     string `xml:"data"`
	Mime     string `xml:"mime"`
	FileName string `xml:"resource-attributes>file-name"`
}

func importENEX(ctx context.Context, store *Store, sourcePath string, destinationNotebookID string, progress func(float64, string)) (ImportReport, error) {
	if progress == nil {
		progress = func(float64, string) {}
	}
	report := ImportReport{Source: sourcePath, Kind: "enex", Warnings: make([]ImportWarning, 0), EncryptedSkipped: make([]string, 0)}
	file, err := os.Open(sourcePath)
	if err != nil {
		return report, err
	}
	defer file.Close()
	stat, err := file.Stat()
	if err != nil {
		return report, err
	}
	if stat.Size() > 512*1024*1024 {
		return report, errors.New("ENEX 檔案超過 512 MB 限制")
	}
	data, err := io.ReadAll(file)
	if err != nil {
		return report, err
	}
	var document enexExport
	if err := xml.Unmarshal(data, &document); err != nil {
		return report, fmt.Errorf("ENEX XML 損壞: %w", err)
	}
	progress(0.2, "建立 Evernote 筆記本")
	var notebook Notebook
	if destinationNotebookID != "" {
		notebook, err = store.getNotebook(ctx, destinationNotebookID)
		if err != nil {
			return report, errors.New("目的筆記本不存在")
		}
	} else {
		notebook, err = store.CreateNotebook(ctx, strings.TrimSuffix(filepath.Base(sourcePath), filepath.Ext(sourcePath)), "")
		if err != nil {
			return report, err
		}
		report.Notebooks = 1
	}
	report.DestinationFolder = notebook.Title
	for index, note := range document.Notes {
		body := extractENEXContent(note.Content)
		markdown := htmlToMarkdown(body)
		created := parseEvernoteTime(note.Created)
		updated := parseEvernoteTime(note.Updated)
		resourceIDs := make([]string, 0, len(note.Resources))
		for _, resource := range note.Resources {
			resourceData, err := base64.StdEncoding.DecodeString(strings.Join(strings.Fields(resource.Data), ""))
			if err != nil || len(resourceData) == 0 {
				report.Warnings = append(report.Warnings, ImportWarning{Item: note.Title, Message: "附件 base64 無法解碼"})
				continue
			}
			id := newID()
			name := fallbackString(resource.FileName, id)
			path := store.resourcePath(id)
			if err := os.WriteFile(path, resourceData, 0o644); err != nil {
				report.Warnings = append(report.Warnings, ImportWarning{Item: note.Title, Message: err.Error()})
				continue
			}
			mimeType := fallbackString(resource.Mime, detectMime(path))
			name = normalizeResourceFilename(name, name, mimeType, "")
			now := nowMillis()
			_, _ = store.db.ExecContext(ctx,
				`INSERT INTO resources(id,note_id,title,mime,filename,file_size,created_at,updated_at)
				 VALUES(?,?,?,?,?,?,?,?)`,
				id, "", strings.TrimSuffix(name, filepath.Ext(name)), mimeType, name, len(resourceData), now, now,
			)
			report.Resources++
			resourceIDs = append(resourceIDs, id)
			markdown += fmt.Sprintf("\n\n[%s](:/%s)\n", strings.TrimSuffix(name, filepath.Ext(name)), id)
		}
		noteRecord, err := store.CreateNote(ctx, notebook.ID, note.Title, markdown)
		if err != nil {
			report.Warnings = append(report.Warnings, ImportWarning{Item: note.Title, Message: err.Error()})
			continue
		}
		if updated > 0 || created > 0 {
			_, _ = store.db.ExecContext(ctx, `UPDATE notes SET created_at=?,updated_at=? WHERE id=?`, created, updated, noteRecord.ID)
		}
		cleanTags := make([]string, 0, len(note.Tags))
		for _, tag := range note.Tags {
			if tag = strings.TrimSpace(tag); tag != "" {
				cleanTags = append(cleanTags, tag)
			}
		}
		if len(cleanTags) > 0 {
			_ = store.SetNoteTags(ctx, noteRecord.ID, cleanTags)
			report.Tags += len(cleanTags)
		}
		for _, resourceID := range resourceIDs {
			_, _ = store.db.ExecContext(ctx, `UPDATE resources SET note_id=? WHERE id=?`, noteRecord.ID, resourceID)
		}
		report.Notes++
		progress(0.2+0.75*float64(index+1)/float64(max(1, len(document.Notes))), "匯入 Evernote 筆記")
	}
	progress(1, "ENEX 匯入完成")
	return report, nil
}

func extractENEXContent(value string) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "<![CDATA[") && strings.HasSuffix(value, "]]>") {
		return strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(value, "<![CDATA["), "]]>"))
	}
	value = html.UnescapeString(value)
	lower := strings.ToLower(value)
	if start := strings.Index(lower, "<en-note"); start >= 0 {
		if end := strings.LastIndex(lower, "</en-note>"); end > start {
			if closeTag := strings.Index(value[start:], ">"); closeTag >= 0 {
				return value[start+closeTag+1 : end]
			}
		}
	}
	return value
}

func parseEvernoteTime(value string) int64 {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	for _, layout := range []string{"20060102T150405Z", time.RFC3339, "2006-01-02T15:04:05Z"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.UnixMilli()
		}
	}
	return 0
}

func importMarkdownFile(ctx context.Context, store *Store, sourcePath string, destinationNotebookID string) (ImportReport, error) {
	report := ImportReport{Source: sourcePath, Kind: "markdown", Warnings: make([]ImportWarning, 0), EncryptedSkipped: make([]string, 0)}
	data, err := os.ReadFile(sourcePath)
	if err != nil {
		return report, err
	}
	if len(data) > 64*1024*1024 {
		return report, errors.New("Markdown 檔案超過 64 MB 限制")
	}
	var notebook Notebook
	if destinationNotebookID != "" {
		notebook, err = store.getNotebook(ctx, destinationNotebookID)
		if err != nil {
			return report, errors.New("目的筆記本不存在")
		}
	} else {
		notebookTitle := strings.TrimSuffix(filepath.Base(sourcePath), filepath.Ext(sourcePath))
		notebook, err = store.CreateNotebook(ctx, notebookTitle, "")
		if err != nil {
			return report, err
		}
		report.Notebooks = 1
	}
	note, err := store.CreateNote(ctx, notebook.ID, defaultTitleFromBody(string(data)), string(data))
	if err != nil {
		return report, err
	}
	if stat, err := os.Stat(sourcePath); err == nil {
		_, _ = store.db.ExecContext(ctx, `UPDATE notes SET created_at=?,updated_at=? WHERE id=?`, stat.ModTime().UnixMilli(), stat.ModTime().UnixMilli(), note.ID)
	}
	report.Notes = 1
	report.DestinationFolder = notebook.Title
	return report, nil
}

func exportJEX(ctx context.Context, store *Store, notebookID string, destination string) error {
	type exportRow struct {
		id, parentID, title, body, created, updated string
	}
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		return err
	}
	notebookMap := map[string]Notebook{}
	for _, item := range notebooks {
		notebookMap[item.ID] = item
	}
	if _, ok := notebookMap[notebookID]; !ok {
		return errors.New("筆記本不存在")
	}

	file, err := os.Create(destination)
	if err != nil {
		return err
	}
	defer file.Close()
	writer := tar.NewWriter(file)
	defer writer.Close()

	addEntry := func(name string, data []byte) error {
		header := &tar.Header{Name: name, Mode: 0o600, Size: int64(len(data)), ModTime: time.Now()}
		if err := writer.WriteHeader(header); err != nil {
			return err
		}
		_, err := writer.Write(data)
		return err
	}

	// Include the selected notebook and its descendants.
	include := map[string]bool{notebookID: true}
	changed := true
	for changed {
		changed = false
		for _, item := range notebooks {
			if !include[item.ID] && include[item.ParentID] {
				include[item.ID] = true
				changed = true
			}
		}
	}
	for _, item := range notebooks {
		if !include[item.ID] {
			continue
		}
		content := serializeRawItem(item.Title, "", map[string]string{
			"id": item.ID, "parent_id": item.ParentID, "created_time": formatJoplinTime(item.CreatedAt),
			"updated_time": formatJoplinTime(item.UpdatedAt), "type_": "2",
		})
		if err := addEntry(item.ID+".md", []byte(content)); err != nil {
			return err
		}
	}

	rows, err := store.db.QueryContext(ctx,
		`SELECT id,notebook_id,title,body,created_at,updated_at,is_todo,todo_due,todo_completed,
		        source_url,author,is_conflict FROM notes WHERE deleted_at=0 ORDER BY updated_at`,
	)
	if err != nil {
		return err
	}
	exportedNotes := map[string]bool{}
	for rows.Next() {
		var id, parentID, title, body, sourceURL, author string
		var created, updated, todoDue, todoCompleted int64
		var isTodo, isConflict int
		if err := rows.Scan(&id, &parentID, &title, &body, &created, &updated, &isTodo, &todoDue,
			&todoCompleted, &sourceURL, &author, &isConflict); err != nil {
			rows.Close()
			return err
		}
		if !include[parentID] {
			continue
		}
		exportedNotes[id] = true
		content := serializeRawItem(title, body, map[string]string{
			"id": id, "parent_id": parentID, "created_time": formatJoplinTime(created),
			"updated_time": formatJoplinTime(updated), "is_todo": strconv.Itoa(isTodo),
			"todo_due": formatJoplinTime(todoDue), "todo_completed": formatJoplinTime(todoCompleted),
			"source_url": sourceURL, "author": author, "is_conflict": strconv.Itoa(isConflict),
			"type_": "1",
		})
		if err := addEntry(id+".md", []byte(content)); err != nil {
			rows.Close()
			return err
		}
	}
	rows.Close()

	tagRows, err := store.db.QueryContext(ctx,
		`SELECT DISTINCT t.id,t.title,t.created_at,t.updated_at,nt.note_id,nt.created_at
		 FROM tags t JOIN note_tags nt ON nt.tag_id=t.id ORDER BY t.title`,
	)
	if err != nil {
		return err
	}
	writtenTags := map[string]bool{}
	for tagRows.Next() {
		var tagID, title, noteID string
		var tagCreated, tagUpdated, noteTagCreated int64
		if err := tagRows.Scan(&tagID, &title, &tagCreated, &tagUpdated, &noteID, &noteTagCreated); err != nil {
			tagRows.Close()
			return err
		}
		if !exportedNotes[noteID] {
			continue
		}
		if !writtenTags[tagID] {
			content := serializeRawItem(title, "", map[string]string{
				"id": tagID, "created_time": formatJoplinTime(tagCreated),
				"updated_time": formatJoplinTime(tagUpdated), "type_": "4",
			})
			if err := addEntry(tagID+".md", []byte(content)); err != nil {
				tagRows.Close()
				return err
			}
			writtenTags[tagID] = true
		}
		noteTagID := newID()
		content := serializeRawItem("", "", map[string]string{
			"id": noteTagID, "note_id": noteID, "tag_id": tagID,
			"created_time": formatJoplinTime(noteTagCreated), "updated_time": formatJoplinTime(noteTagCreated),
			"type_": "5",
		})
		if err := addEntry(noteTagID+".md", []byte(content)); err != nil {
			tagRows.Close()
			return err
		}
	}
	tagRows.Close()

	resourceRows, err := store.db.QueryContext(ctx,
		`SELECT id,title,mime,filename,file_size,created_at,updated_at FROM resources ORDER BY created_at`,
	)
	if err != nil {
		return err
	}
	for resourceRows.Next() {
		var id, title, mimeType, filename string
		var size, created, updated int64
		if err := resourceRows.Scan(&id, &title, &mimeType, &filename, &size, &created, &updated); err != nil {
			resourceRows.Close()
			return err
		}
		extension := strings.TrimPrefix(filepath.Ext(filename), ".")
		data, err := os.ReadFile(store.resourcePath(id))
		if err != nil {
			continue
		}
		props := map[string]string{
			"id": id, "mime": mimeType, "filename": filename, "file_extension": extension,
			"size": strconv.FormatInt(size, 10), "created_time": formatJoplinTime(created),
			"updated_time": formatJoplinTime(updated), "encryption_applied": "0",
			"encryption_blob_encrypted": "0", "type_": "3",
		}
		if err := addEntry(id+".md", []byte(serializeRawItem(title, "", props))); err != nil {
			resourceRows.Close()
			return err
		}
		resourceName := id
		if extension != "" {
			resourceName += "." + extension
		}
		if err := addEntry("resources/"+resourceName, data); err != nil {
			resourceRows.Close()
			return err
		}
	}
	resourceRows.Close()
	return writer.Close()
}

func serializeRawItem(title string, body string, props map[string]string) string {
	keys := make([]string, 0, len(props))
	for key := range props {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	propertyLines := make([]string, 0, len(keys))
	for _, key := range keys {
		value := props[key]
		if key != "body" {
			value = strings.ReplaceAll(value, "\\", "\\\\")
			value = strings.ReplaceAll(value, "\r", `\r`)
			value = strings.ReplaceAll(value, "\n", `\n`)
		}
		propertyLines = append(propertyLines, key+": "+value)
	}
	parts := []string{}
	if title != "" {
		parts = append(parts, title)
	}
	if body != "" {
		parts = append(parts, body)
	}
	parts = append(parts, strings.Join(propertyLines, "\n"))
	return strings.Join(parts, "\n\n") + "\n"
}

func formatJoplinTime(value int64) string {
	if value <= 0 {
		return ""
	}
	return time.UnixMilli(value).UTC().Format("2006-01-02T15:04:05.000") + "Z"
}

func isNotebookDescendant(notebooks map[string]Notebook, notebookID string, rootID string) bool {
	visited := map[string]bool{}
	for notebookID != "" && !visited[notebookID] {
		if notebookID == rootID {
			return true
		}
		visited[notebookID] = true
		notebook, ok := notebooks[notebookID]
		if !ok {
			return false
		}
		notebookID = notebook.ParentID
	}
	return false
}

func safeFilename(value string) string {
	value = strings.TrimSpace(value)
	value = regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f]`).ReplaceAllString(value, "-")
	value = strings.Trim(value, ". ")
	if len([]rune(value)) > 120 {
		value = string([]rune(value)[:120])
	}
	return value
}

func importReadLines(data []byte) []string {
	scanner := bufio.NewScanner(bytes.NewReader(data))
	lines := make([]string, 0)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	return lines
}
