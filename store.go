package main

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	sqlite "modernc.org/sqlite"
)

const schemaVersion = 4

var internalResourcePattern = regexp.MustCompile(`:/[A-Za-z0-9]{32}`)

type textSearchPatternKey struct {
	query         string
	caseSensitive bool
	wholeWord     bool
}

var textSearchPatternCache = struct {
	sync.Mutex
	entries map[textSearchPatternKey]*regexp.Regexp
}{
	entries: make(map[textSearchPatternKey]*regexp.Regexp),
}

func init() {
	sqlite.MustRegisterDeterministicScalarFunction(
		"puffjoplin_search_match",
		4,
		func(_ *sqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
			text := searchArgumentString(args[0])
			query := searchArgumentString(args[1])
			caseSensitive := searchArgumentFlag(args[2])
			wholeWord := searchArgumentFlag(args[3])
			if query == "" {
				return int64(1), nil
			}
			pattern := compiledTextSearchPattern(query, caseSensitive, wholeWord)
			if pattern.MatchString(text) {
				return int64(1), nil
			}
			return int64(0), nil
		},
	)
}

func searchArgumentString(value driver.Value) string {
	switch typed := value.(type) {
	case string:
		return typed
	case []byte:
		return string(typed)
	default:
		return ""
	}
}

func searchArgumentFlag(value driver.Value) bool {
	switch typed := value.(type) {
	case int64:
		return typed != 0
	case bool:
		return typed
	default:
		return false
	}
}

func compiledTextSearchPattern(query string, caseSensitive bool, wholeWord bool) *regexp.Regexp {
	key := textSearchPatternKey{
		query: query, caseSensitive: caseSensitive, wholeWord: wholeWord,
	}
	textSearchPatternCache.Lock()
	defer textSearchPatternCache.Unlock()
	if pattern := textSearchPatternCache.entries[key]; pattern != nil {
		return pattern
	}
	if len(textSearchPatternCache.entries) >= 256 {
		textSearchPatternCache.entries = make(map[textSearchPatternKey]*regexp.Regexp)
	}
	source := regexp.QuoteMeta(query)
	if wholeWord {
		source = `(?:^|[^\p{L}\p{N}_])(?:` + source + `)(?:$|[^\p{L}\p{N}_])`
	}
	if !caseSensitive {
		source = `(?i)` + source
	}
	pattern := regexp.MustCompile(source)
	textSearchPatternCache.entries[key] = pattern
	return pattern
}

const notebookSubtreeCondition = `n.notebook_id IN (
	WITH RECURSIVE notebook_subtree(id) AS (
		SELECT ?
		UNION ALL
		SELECT child.id FROM notebooks child
		JOIN notebook_subtree parent ON child.parent_id = parent.id
	)
	SELECT id FROM notebook_subtree
)`

type Store struct {
	db           *sql.DB
	dbPath       string
	resourcesDir string
}

func OpenStore(dbPath string, resourcesDir string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, fmt.Errorf("create data directory: %w", err)
	}
	if err := os.MkdirAll(resourcesDir, 0o755); err != nil {
		return nil, fmt.Errorf("create resource directory: %w", err)
	}

	// Connection-local pragmas must be present in the DSN. Running them once
	// after sql.Open only configures whichever pooled connection served them.
	parameters := url.Values{}
	for _, pragma := range []string{
		"busy_timeout(5000)",
		"foreign_keys(1)",
		"synchronous(NORMAL)",
		"temp_store(MEMORY)",
	} {
		parameters.Add("_pragma", pragma)
	}
	databasePath := filepath.ToSlash(dbPath)
	if filepath.VolumeName(dbPath) != "" {
		databasePath = "/" + strings.TrimPrefix(databasePath, "/")
	}
	dsn := (&url.URL{Scheme: "file", Path: databasePath, RawQuery: parameters.Encode()}).String()
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	// WAL permits concurrent readers while one connection commits a write.
	// Keeping a small pool avoids re-entrant SELECTs while a row cursor is open.
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(0)

	store := &Store{db: db, dbPath: dbPath, resourcesDir: resourcesDir}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	for _, pragma := range []string{
		"PRAGMA journal_mode = WAL",
		"PRAGMA wal_autocheckpoint = 1000",
	} {
		if _, err := db.ExecContext(ctx, pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("%s: %w", pragma, err)
		}
	}

	if err := store.initialize(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return store, nil
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) initialize(ctx context.Context) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS schema_meta (
			version INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS notebooks (
			id TEXT PRIMARY KEY,
			parent_id TEXT NOT NULL DEFAULT '',
			title TEXT NOT NULL DEFAULT '',
			icon TEXT NOT NULL DEFAULT '',
			sort_order INTEGER NOT NULL DEFAULT 0,
			storage_kind TEXT NOT NULL DEFAULT 'database',
			storage_root TEXT NOT NULL DEFAULT '',
			storage_path TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS notebooks_parent_sort ON notebooks(parent_id, sort_order, title)`,
		`CREATE TABLE IF NOT EXISTS notes (
			id TEXT PRIMARY KEY,
			notebook_id TEXT NOT NULL,
			title TEXT NOT NULL DEFAULT '',
			body TEXT NOT NULL DEFAULT '',
			is_todo INTEGER NOT NULL DEFAULT 0,
			todo_due INTEGER NOT NULL DEFAULT 0,
			todo_completed INTEGER NOT NULL DEFAULT 0,
			source_url TEXT NOT NULL DEFAULT '',
			author TEXT NOT NULL DEFAULT '',
			is_conflict INTEGER NOT NULL DEFAULT 0,
			is_pinned INTEGER NOT NULL DEFAULT 0,
			sort_order INTEGER NOT NULL DEFAULT 0,
			storage_kind TEXT NOT NULL DEFAULT 'database',
			external_path TEXT NOT NULL DEFAULT '',
			external_mtime INTEGER NOT NULL DEFAULT 0,
			external_size INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			deleted_at INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY(notebook_id) REFERENCES notebooks(id) ON DELETE RESTRICT
		)`,
		`CREATE INDEX IF NOT EXISTS notes_notebook_updated ON notes(notebook_id, deleted_at, updated_at DESC)`,
		`CREATE INDEX IF NOT EXISTS notes_deleted_updated ON notes(deleted_at, updated_at DESC)`,
		`CREATE TABLE IF NOT EXISTS tags (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL COLLATE NOCASE UNIQUE,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS note_tags (
			note_id TEXT NOT NULL,
			tag_id TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			PRIMARY KEY(note_id, tag_id),
			FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE,
			FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS note_tags_tag ON note_tags(tag_id, note_id)`,
		`CREATE TABLE IF NOT EXISTS resources (
			id TEXT PRIMARY KEY,
			note_id TEXT NOT NULL DEFAULT '',
			title TEXT NOT NULL DEFAULT '',
			mime TEXT NOT NULL DEFAULT 'application/octet-stream',
			filename TEXT NOT NULL DEFAULT '',
			file_size INTEGER NOT NULL DEFAULT 0,
			storage_kind TEXT NOT NULL DEFAULT 'database',
			external_path TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS resources_note ON resources(note_id)`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS note_additional_info (
			note_id TEXT PRIMARY KEY,
			fields_json TEXT NOT NULL,
			updated_at INTEGER NOT NULL,
			FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS import_jobs (
			id TEXT PRIMARY KEY,
			source TEXT NOT NULL,
			kind TEXT NOT NULL,
			report_json TEXT NOT NULL,
			created_at INTEGER NOT NULL
		)`,
		`CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
			note_id UNINDEXED,
			title,
			body,
			tokenize = 'unicode61 remove_diacritics 2'
		)`,
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin schema transaction: %w", err)
	}
	defer tx.Rollback()

	for _, statement := range statements {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("initialize schema: %w", err)
		}
	}
	if err := ensureNotesPinnedColumn(ctx, tx); err != nil {
		return err
	}
	for _, column := range []struct {
		table      string
		name       string
		definition string
	}{
		{"notebooks", "storage_kind", "TEXT NOT NULL DEFAULT 'database'"},
		{"notebooks", "storage_root", "TEXT NOT NULL DEFAULT ''"},
		{"notebooks", "storage_path", "TEXT NOT NULL DEFAULT ''"},
		{"notes", "storage_kind", "TEXT NOT NULL DEFAULT 'database'"},
		{"notes", "external_path", "TEXT NOT NULL DEFAULT ''"},
		{"notes", "external_mtime", "INTEGER NOT NULL DEFAULT 0"},
		{"notes", "external_size", "INTEGER NOT NULL DEFAULT 0"},
		{"resources", "storage_kind", "TEXT NOT NULL DEFAULT 'database'"},
		{"resources", "external_path", "TEXT NOT NULL DEFAULT ''"},
	} {
		if err := ensureTableColumn(ctx, tx, column.table, column.name, column.definition); err != nil {
			return err
		}
	}
	for _, statement := range []string{
		`CREATE UNIQUE INDEX IF NOT EXISTS notebooks_managed_path
		 ON notebooks(storage_root COLLATE NOCASE, storage_path COLLATE NOCASE)
		 WHERE storage_kind = 'directory'`,
		`CREATE UNIQUE INDEX IF NOT EXISTS notes_external_path
		 ON notes(external_path COLLATE NOCASE)
		 WHERE storage_kind = 'directory' AND external_path <> ''`,
		`CREATE UNIQUE INDEX IF NOT EXISTS resources_external_path
		 ON resources(note_id, external_path COLLATE NOCASE)
		 WHERE storage_kind = 'directory' AND external_path <> ''`,
	} {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("initialize managed directory index: %w", err)
		}
	}

	var count int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM schema_meta`).Scan(&count); err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}
	if count == 0 {
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_meta(version, updated_at) VALUES(?, ?)`, schemaVersion, nowMillis()); err != nil {
			return fmt.Errorf("write schema version: %w", err)
		}
	} else {
		var version int
		if err := tx.QueryRowContext(ctx, `SELECT version FROM schema_meta LIMIT 1`).Scan(&version); err != nil {
			return fmt.Errorf("read schema version: %w", err)
		}
		if version > schemaVersion {
			return fmt.Errorf("database schema %d is newer than this application (%d)", version, schemaVersion)
		}
		if version < schemaVersion {
			if _, err := tx.ExecContext(ctx, `UPDATE schema_meta SET version = ?, updated_at = ?`, schemaVersion, nowMillis()); err != nil {
				return fmt.Errorf("update schema version: %w", err)
			}
		}
	}

	var notebookCount int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM notebooks`).Scan(&notebookCount); err != nil {
		return fmt.Errorf("count notebooks: %w", err)
	}
	if notebookCount == 0 {
		now := nowMillis()
		_, err := tx.ExecContext(ctx,
			`INSERT INTO notebooks(id, parent_id, title, icon, sort_order, created_at, updated_at)
			 VALUES(?, '', ?, '', 0, ?, ?)`,
			newID(), "我的筆記", now, now,
		)
		if err != nil {
			return fmt.Errorf("create default notebook: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit schema: %w", err)
	}
	if err := s.normalizeStoredResourceFilenames(ctx); err != nil {
		return err
	}
	return nil
}

func ensureNotesPinnedColumn(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `PRAGMA table_info(notes)`)
	if err != nil {
		return fmt.Errorf("read notes schema: %w", err)
	}
	found := false
	for rows.Next() {
		var columnID, notNull, primaryKey int
		var name, dataType string
		var defaultValue sql.NullString
		if err := rows.Scan(&columnID, &name, &dataType, &notNull, &defaultValue, &primaryKey); err != nil {
			rows.Close()
			return fmt.Errorf("scan notes schema: %w", err)
		}
		if name == "is_pinned" {
			found = true
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if found {
		return nil
	}
	if _, err := tx.ExecContext(ctx, `ALTER TABLE notes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`); err != nil {
		return fmt.Errorf("add notes.is_pinned: %w", err)
	}
	return nil
}

func ensureTableColumn(ctx context.Context, tx *sql.Tx, table string, column string, definition string) error {
	rows, err := tx.QueryContext(ctx, `PRAGMA table_info(`+table+`)`)
	if err != nil {
		return fmt.Errorf("read %s schema: %w", table, err)
	}
	found := false
	for rows.Next() {
		var columnID, notNull, primaryKey int
		var name, dataType string
		var defaultValue sql.NullString
		if err := rows.Scan(&columnID, &name, &dataType, &notNull, &defaultValue, &primaryKey); err != nil {
			rows.Close()
			return fmt.Errorf("scan %s schema: %w", table, err)
		}
		if name == column {
			found = true
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if found {
		return nil
	}
	if _, err := tx.ExecContext(ctx, `ALTER TABLE `+table+` ADD COLUMN `+column+` `+definition); err != nil {
		return fmt.Errorf("add %s.%s: %w", table, column, err)
	}
	return nil
}

func (s *Store) normalizeStoredResourceFilenames(ctx context.Context) error {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, title, mime, filename FROM resources WHERE storage_kind = ?`,
		storageKindDatabase,
	)
	if err != nil {
		return fmt.Errorf("read resource filenames: %w", err)
	}
	type update struct {
		id       string
		filename string
	}
	updates := make([]update, 0)
	for rows.Next() {
		var id, title, mimeType, filename string
		if err := rows.Scan(&id, &title, &mimeType, &filename); err != nil {
			rows.Close()
			return fmt.Errorf("scan resource filename: %w", err)
		}
		normalized := normalizeResourceFilename(filename, title, mimeType, "")
		if normalized != filename {
			updates = append(updates, update{id: id, filename: normalized})
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, item := range updates {
		if _, err := s.db.ExecContext(ctx, `UPDATE resources SET filename = ? WHERE id = ?`, item.filename, item.id); err != nil {
			return fmt.Errorf("update resource filename: %w", err)
		}
	}
	return nil
}

func nowMillis() int64 {
	return time.Now().UnixMilli()
}

func newID() string {
	return strings.ReplaceAll(uuid.NewString(), "-", "")
}

func (s *Store) Bootstrap(ctx context.Context, dataDir string, joplinProfile string) (BootstrapState, error) {
	state := BootstrapState{
		Status:          "ready",
		AppVersion:      "0.1.0",
		DataDir:         dataDir,
		JoplinProfile:   joplinProfile,
		CanImportJoplin: joplinProfile != "",
	}
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM notes WHERE deleted_at = 0`).Scan(&state.NoteCount); err != nil {
		return state, err
	}
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM notebooks`).Scan(&state.NotebookCount); err != nil {
		return state, err
	}
	if state.NoteCount == 0 {
		state.Status = "empty"
		state.Message = "尚未新增筆記"
	}
	return state, nil
}

func (s *Store) ListNotebooks(ctx context.Context) ([]Notebook, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, parent_id, title, icon, sort_order, storage_kind, storage_root, storage_path, created_at, updated_at
		 FROM notebooks ORDER BY parent_id, sort_order, title COLLATE NOCASE`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Notebook, 0)
	for rows.Next() {
		var item Notebook
		if err := rows.Scan(
			&item.ID, &item.ParentID, &item.Title, &item.Icon, &item.SortOrder,
			&item.StorageKind, &item.StorageRoot, &item.StoragePath,
			&item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) CreateNotebook(ctx context.Context, title string, parentID string) (Notebook, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return Notebook{}, errors.New("筆記本名稱不可為空")
	}
	if parentID != "" {
		parent, err := s.getNotebook(ctx, parentID)
		if err != nil {
			return Notebook{}, errors.New("父筆記本不存在")
		}
		if parent.StorageKind == storageKindDirectory {
			directory := managedNotebookDirectory(parent)
			if info, err := os.Stat(directory); err != nil || !info.IsDir() {
				return Notebook{}, errors.New("父筆記本資料夾目前無法存取")
			}
			name := sanitizeManagedFilename(title, "新筆記本")
			name = uniqueManagedFilename(directory, name)
			if err := os.Mkdir(filepath.Join(directory, name), 0o755); err != nil {
				return Notebook{}, err
			}
			rootID, rootPath, err := s.managedRoot(ctx, parent)
			if err != nil {
				return Notebook{}, err
			}
			if _, err := s.reindexManagedDirectory(ctx, rootID, rootPath); err != nil {
				return Notebook{}, err
			}
			relativePath := filepath.ToSlash(filepath.Join(parent.StoragePath, name))
			var item Notebook
			err = s.db.QueryRowContext(ctx,
				`SELECT id, parent_id, title, icon, sort_order, storage_kind, storage_root, storage_path, created_at, updated_at
				 FROM notebooks
				 WHERE storage_kind = ? AND storage_root = ? COLLATE NOCASE AND storage_path = ? COLLATE NOCASE`,
				storageKindDirectory, parent.StorageRoot, relativePath,
			).Scan(
				&item.ID, &item.ParentID, &item.Title, &item.Icon, &item.SortOrder,
				&item.StorageKind, &item.StorageRoot, &item.StoragePath,
				&item.CreatedAt, &item.UpdatedAt,
			)
			return item, err
		}
		var exists int
		if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM notebooks WHERE id = ?`, parentID).Scan(&exists); err != nil {
			return Notebook{}, err
		}
		if exists == 0 {
			return Notebook{}, errors.New("父筆記本不存在")
		}
	}
	now := nowMillis()
	item := Notebook{
		ID: newID(), ParentID: parentID, Title: title, StorageKind: storageKindDatabase,
		CreatedAt: now, UpdatedAt: now,
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO notebooks(id, parent_id, title, icon, sort_order, created_at, updated_at)
		 VALUES(?, ?, ?, '', 0, ?, ?)`,
		item.ID, item.ParentID, item.Title, item.CreatedAt, item.UpdatedAt,
	)
	return item, err
}

func (s *Store) RenameNotebook(ctx context.Context, id string, title string) (Notebook, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return Notebook{}, errors.New("筆記本名稱不可為空")
	}
	notebook, err := s.getNotebook(ctx, id)
	if err != nil {
		return Notebook{}, errors.New("筆記本不存在")
	}
	if notebook.StorageKind == storageKindDirectory {
		return Notebook{}, errors.New("直接管理的資料夾名稱由檔案系統決定")
	}
	now := nowMillis()
	result, err := s.db.ExecContext(ctx, `UPDATE notebooks SET title = ?, updated_at = ? WHERE id = ?`, title, now, id)
	if err != nil {
		return Notebook{}, err
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return Notebook{}, errors.New("筆記本不存在")
	}
	return s.getNotebook(ctx, id)
}

func (s *Store) DeleteNotebook(ctx context.Context, id string, deleteChildren bool) error {
	notebook, err := s.getNotebook(ctx, id)
	if err != nil {
		return errors.New("筆記本不存在")
	}
	if notebook.StorageKind == storageKindDirectory {
		return s.unregisterManagedDirectory(ctx, notebook)
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var exists int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM notebooks WHERE id = ?`, id).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		return errors.New("筆記本不存在")
	}

	rows, err := tx.QueryContext(ctx, `
		WITH RECURSIVE notebook_tree(id) AS (
			SELECT ?
			UNION ALL
			SELECT child.id FROM notebooks child JOIN notebook_tree parent ON child.parent_id = parent.id
		)
		SELECT id FROM notebook_tree`, id)
	if err != nil {
		return err
	}
	notebookIDs := make([]string, 0)
	for rows.Next() {
		var notebookID string
		if err := rows.Scan(&notebookID); err != nil {
			rows.Close()
			return err
		}
		notebookIDs = append(notebookIDs, notebookID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	if !deleteChildren && len(notebookIDs) > 1 {
		return errors.New("筆記本內仍有子筆記本")
	}
	noteCount, err := s.countNotesInNotebooks(ctx, tx, notebookIDs)
	if err != nil {
		return err
	}
	if noteCount > 0 && !deleteChildren {
		return errors.New("筆記本內仍有筆記")
	}

	if deleteChildren {
		resourcePaths, err := s.deleteNotesInNotebooks(ctx, tx, notebookIDs)
		if err != nil {
			return err
		}
		for _, notebookID := range notebookIDs {
			if _, err := tx.ExecContext(ctx, `DELETE FROM notebooks WHERE id = ?`, notebookID); err != nil {
				return err
			}
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)`); err != nil {
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		for _, path := range resourcePaths {
			_ = os.Remove(path)
		}
		return nil
	}

	result, err := tx.ExecContext(ctx, `DELETE FROM notebooks WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return errors.New("筆記本不存在")
	}
	return tx.Commit()
}

func (s *Store) countNotesInNotebooks(ctx context.Context, tx *sql.Tx, notebookIDs []string) (int, error) {
	if len(notebookIDs) == 0 {
		return 0, nil
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(notebookIDs)), ",")
	args := make([]any, 0, len(notebookIDs))
	for _, notebookID := range notebookIDs {
		args = append(args, notebookID)
	}
	var count int
	err := tx.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM notes WHERE notebook_id IN (`+placeholders+`)`,
		args...,
	).Scan(&count)
	return count, err
}

func (s *Store) deleteNotesInNotebooks(ctx context.Context, tx *sql.Tx, notebookIDs []string) ([]string, error) {
	if len(notebookIDs) == 0 {
		return nil, nil
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(notebookIDs)), ",")
	args := make([]any, 0, len(notebookIDs))
	for _, notebookID := range notebookIDs {
		args = append(args, notebookID)
	}
	rows, err := tx.QueryContext(ctx,
		`SELECT r.id FROM resources r JOIN notes n ON n.id = r.note_id
		 WHERE n.notebook_id IN (`+placeholders+`)`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	resourceIDs := make([]string, 0)
	for rows.Next() {
		var resourceID string
		if err := rows.Scan(&resourceID); err != nil {
			rows.Close()
			return nil, err
		}
		resourceIDs = append(resourceIDs, resourceID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx,
		`DELETE FROM notes_fts WHERE note_id IN (
			SELECT id FROM notes WHERE notebook_id IN (`+placeholders+`)
		)`,
		args...,
	); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx,
		`DELETE FROM resources WHERE note_id IN (
			SELECT id FROM notes WHERE notebook_id IN (`+placeholders+`)
		)`,
		args...,
	); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx,
		`DELETE FROM notes WHERE notebook_id IN (`+placeholders+`)`,
		args...,
	); err != nil {
		return nil, err
	}
	paths := make([]string, 0, len(resourceIDs))
	for _, resourceID := range resourceIDs {
		paths = append(paths, filepath.Join(s.resourcesDir, resourceID))
	}
	return paths, nil
}

func (s *Store) getNotebook(ctx context.Context, id string) (Notebook, error) {
	var item Notebook
	err := s.db.QueryRowContext(ctx,
		`SELECT id, parent_id, title, icon, sort_order, storage_kind, storage_root, storage_path, created_at, updated_at
		 FROM notebooks WHERE id = ?`,
		id,
	).Scan(
		&item.ID, &item.ParentID, &item.Title, &item.Icon, &item.SortOrder,
		&item.StorageKind, &item.StorageRoot, &item.StoragePath,
		&item.CreatedAt, &item.UpdatedAt,
	)
	return item, err
}

func (s *Store) ListNotes(ctx context.Context, query NoteQuery) (NotePage, error) {
	if query.Limit <= 0 || query.Limit > 500 {
		query.Limit = 200
	}
	if query.Offset < 0 {
		query.Offset = 0
	}
	sortBy := strings.ToLower(strings.TrimSpace(query.SortBy))
	sortDirection := strings.ToLower(strings.TrimSpace(query.SortDirection))
	if sortDirection != "asc" && sortDirection != "desc" {
		sortDirection = "desc"
	}
	sortExpression := "n.updated_at"
	switch sortBy {
	case "title":
		sortExpression = "n.title COLLATE NOCASE"
	case "created":
		sortExpression = "n.created_at"
	case "due":
		sortExpression = "n.todo_due"
	case "", "updated":
		sortExpression = "n.updated_at"
	default:
		sortBy = "updated"
		sortExpression = "n.updated_at"
	}
	sqlDirection := "DESC"
	if sortDirection == "asc" {
		sqlDirection = "ASC"
	}

	where := []string{"1 = 1"}
	args := make([]any, 0, 8)
	switch query.View {
	case "trash":
		where = append(where, "n.deleted_at > 0")
		if strings.TrimSpace(query.NotebookID) != "" {
			where = append(where, notebookSubtreeCondition)
			args = append(args, query.NotebookID)
		}
	case "notebook":
		where = append(where, "n.deleted_at = 0", notebookSubtreeCondition)
		args = append(args, query.NotebookID)
	case "tag":
		where = append(where, "n.deleted_at = 0", "EXISTS (SELECT 1 FROM note_tags nt WHERE nt.note_id = n.id AND nt.tag_id = ?)")
		args = append(args, query.TagID)
	case "todo":
		where = append(where, "n.deleted_at = 0", "n.is_todo = 1")
		switch query.TodoStatus {
		case "completed":
			where = append(where, "n.todo_completed > 0")
		case "all":
		default:
			where = append(where, "n.todo_completed = 0")
		}
		if strings.TrimSpace(query.NotebookID) != "" {
			where = append(where, notebookSubtreeCondition)
			args = append(args, query.NotebookID)
		}
	default:
		where = append(where, "n.deleted_at = 0")
	}

	search := strings.TrimSpace(query.Search)
	if search != "" {
		searchField := strings.ToLower(strings.TrimSpace(query.SearchField))
		searchArgs := []any{
			search,
			boolInt(query.SearchCaseSensitive),
			boolInt(query.SearchWholeWord),
		}
		if searchField == "title" {
			where = append(where, `puffjoplin_search_match(n.title, ?, ?, ?)`)
			args = append(args, searchArgs...)
		} else {
			where = append(where,
				`(puffjoplin_search_match(n.title, ?, ?, ?) OR puffjoplin_search_match(n.body, ?, ?, ?))`,
			)
			args = append(args, searchArgs...)
			args = append(args, searchArgs...)
		}
	}
	whereSQL := strings.Join(where, " AND ")

	var total int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM notes n WHERE `+whereSQL, args...).Scan(&total); err != nil {
		return NotePage{}, err
	}

	listArgs := append(append([]any{}, args...), query.Limit, query.Offset)
	orderSQL := "n.is_pinned DESC, "
	if query.View == "todo" {
		orderSQL += "CASE WHEN n.todo_completed = 0 THEN 0 ELSE 1 END ASC, "
		if sortBy == "due" {
			orderSQL += "CASE WHEN n.todo_due = 0 THEN 1 ELSE 0 END ASC, " +
				"n.todo_due " + sqlDirection + ", "
		} else {
			orderSQL += sortExpression + " " + sqlDirection + ", "
		}
	} else {
		orderSQL += sortExpression + " " + sqlDirection + ", "
	}
	orderSQL += "n.title COLLATE NOCASE ASC, n.id ASC"
	rows, err := s.db.QueryContext(ctx,
		`SELECT n.id, n.notebook_id, f.title, n.title, n.body, n.is_todo, n.todo_due,
		        n.todo_completed, n.is_conflict, n.is_pinned, n.created_at, n.updated_at, n.deleted_at,
		        (SELECT COUNT(*) FROM resources r WHERE r.note_id = n.id) AS attachment_count,
		        n.storage_kind
		 FROM notes n
		 JOIN notebooks f ON f.id = n.notebook_id
		 WHERE `+whereSQL+`
		 ORDER BY `+orderSQL+`
		 LIMIT ? OFFSET ?`,
		listArgs...,
	)
	if err != nil {
		return NotePage{}, err
	}
	defer rows.Close()

	items := make([]NoteSummary, 0)
	for rows.Next() {
		var item NoteSummary
		var body string
		var isTodo, isConflict, isPinned int
		if err := rows.Scan(
			&item.ID, &item.NotebookID, &item.NotebookTitle, &item.Title, &body,
			&isTodo, &item.TodoDue, &item.TodoCompleted, &isConflict, &isPinned,
			&item.CreatedAt, &item.UpdatedAt, &item.DeletedAt, &item.AttachmentCount,
			&item.StorageKind,
		); err != nil {
			return NotePage{}, err
		}
		item.IsTodo = isTodo != 0
		item.IsConflict = isConflict != 0
		item.IsPinned = isPinned != 0
		item.Snippet = noteSnippet(body, 180)
		item.Tags, _ = s.noteTags(ctx, item.ID)
		items = append(items, item)
	}
	return NotePage{Items: items, Total: total}, rows.Err()
}

func noteSnippet(body string, max int) string {
	body = strings.ReplaceAll(body, "\r\n", "\n")
	body = regexp.MustCompile(`!\[([^\]]*)\]\([^)]+\)`).ReplaceAllString(body, "$1")
	body = regexp.MustCompile(`\[([^\]]+)\]\([^)]+\)`).ReplaceAllString(body, "$1")
	body = regexp.MustCompile(`[#>*_`+"`"+`~-]+`).ReplaceAllString(body, " ")
	body = strings.Join(strings.Fields(body), " ")
	runes := []rune(body)
	if len(runes) > max {
		return string(runes[:max]) + "…"
	}
	return body
}

func (s *Store) GetNote(ctx context.Context, id string) (Note, error) {
	var note Note
	var isTodo, isConflict, isPinned int
	err := s.db.QueryRowContext(ctx,
		`SELECT id, notebook_id, storage_kind, external_path, title, body, is_todo, todo_due,
		        todo_completed, source_url, author, is_conflict, is_pinned, external_mtime,
		        external_size, created_at, updated_at, deleted_at
		 FROM notes WHERE id = ?`,
		id,
	).Scan(
		&note.ID, &note.NotebookID, &note.StorageKind, &note.ExternalPath,
		&note.Title, &note.Body, &isTodo, &note.TodoDue, &note.TodoCompleted,
		&note.SourceURL, &note.Author, &isConflict, &isPinned,
		&note.ExternalMTime, &note.ExternalSize,
		&note.CreatedAt, &note.UpdatedAt, &note.DeletedAt,
	)
	if err != nil {
		return note, err
	}
	note.IsTodo = isTodo != 0
	note.IsConflict = isConflict != 0
	note.IsPinned = isPinned != 0
	if note.StorageKind == storageKindDirectory {
		note, err = s.refreshManagedNote(ctx, note)
		if err != nil {
			return note, err
		}
	}
	note.Tags, err = s.noteTags(ctx, id)
	if err != nil {
		return note, err
	}
	note.Resources, err = s.noteResources(ctx, id)
	if err != nil {
		return note, err
	}
	note.AdditionalInfo, err = s.NoteAdditionalInfo(ctx, id)
	return note, err
}

func (s *Store) CreateNote(ctx context.Context, notebookID string, title string, body string) (Note, error) {
	if notebookID == "" {
		err := s.db.QueryRowContext(ctx, `SELECT id FROM notebooks ORDER BY created_at LIMIT 1`).Scan(&notebookID)
		if err != nil {
			return Note{}, fmt.Errorf("find notebook: %w", err)
		}
	}
	notebook, err := s.getNotebook(ctx, notebookID)
	if err != nil {
		return Note{}, errors.New("筆記本不存在")
	}
	if notebook.StorageKind == storageKindDirectory {
		return s.createManagedNote(ctx, notebook, title, body)
	}
	now := nowMillis()
	if strings.TrimSpace(title) == "" {
		title = defaultTitleFromBody(body)
	}
	note := Note{
		ID: newID(), NotebookID: notebookID, Title: title, Body: body,
		CreatedAt: now, UpdatedAt: now, Tags: []string{}, Resources: []Resource{},
		AdditionalInfo: defaultNoteInfoFields(),
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return note, err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx,
		`INSERT INTO notes(id, notebook_id, title, body, is_todo, todo_due, todo_completed,
		 source_url, author, is_conflict, sort_order, created_at, updated_at, deleted_at)
		 VALUES(?, ?, ?, ?, 0, 0, 0, '', '', 0, 0, ?, ?, 0)`,
		note.ID, note.NotebookID, note.Title, note.Body, note.CreatedAt, note.UpdatedAt,
	)
	if err != nil {
		return note, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO notes_fts(note_id, title, body) VALUES(?, ?, ?)`, note.ID, note.Title, note.Body); err != nil {
		return note, err
	}
	return note, tx.Commit()
}

func defaultTitleFromBody(body string) string {
	for _, line := range strings.Split(strings.ReplaceAll(body, "\r\n", "\n"), "\n") {
		line = strings.TrimSpace(strings.TrimLeft(line, "#> -*"))
		if line != "" {
			runes := []rune(line)
			if len(runes) > 80 {
				line = string(runes[:80])
			}
			return line
		}
	}
	return "未命名筆記"
}

func (s *Store) UpdateNote(ctx context.Context, input NoteInput) (Note, error) {
	if input.ID == "" {
		return Note{}, errors.New("缺少筆記 ID")
	}
	if _, err := s.getNotebook(ctx, input.NotebookID); err != nil {
		return Note{}, errors.New("筆記本不存在")
	}
	var storedNotebookID, existingStorageKind, existingExternalPath, existingTitle, existingBody string
	var existingMTime, existingSize int64
	err := s.db.QueryRowContext(ctx,
		`SELECT notebook_id, storage_kind, external_path, title, body, external_mtime, external_size
		 FROM notes WHERE id = ?`,
		input.ID,
	).Scan(
		&storedNotebookID, &existingStorageKind, &existingExternalPath,
		&existingTitle, &existingBody, &existingMTime, &existingSize,
	)
	if err != nil {
		return Note{}, errors.New("筆記不存在")
	}
	if existingStorageKind == storageKindDirectory {
		return s.updateManagedNote(ctx, Note{
			ID: input.ID, NotebookID: storedNotebookID, StorageKind: existingStorageKind,
			ExternalPath: existingExternalPath, Title: existingTitle, Body: existingBody,
			ExternalMTime: existingMTime, ExternalSize: existingSize,
		}, input)
	}
	now := nowMillis()
	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = defaultTitleFromBody(input.Body)
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Note{}, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx,
		`UPDATE notes SET notebook_id = ?, title = ?, body = ?, is_todo = ?, todo_due = ?,
		        todo_completed = ?, source_url = ?, author = ?, updated_at = ?
		 WHERE id = ?`,
		input.NotebookID, title, input.Body, boolInt(input.IsTodo), input.TodoDue,
		input.TodoCompleted, input.SourceURL, input.Author, now, input.ID,
	)
	if err != nil {
		return Note{}, err
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return Note{}, errors.New("筆記不存在")
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM notes_fts WHERE note_id = ?`, input.ID); err != nil {
		return Note{}, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO notes_fts(note_id, title, body) VALUES(?, ?, ?)`, input.ID, title, input.Body); err != nil {
		return Note{}, err
	}
	if err := tx.Commit(); err != nil {
		return Note{}, err
	}
	return s.GetNote(ctx, input.ID)
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func (s *Store) MoveNote(ctx context.Context, id string, notebookID string) (Note, error) {
	notebook, err := s.getNotebook(ctx, notebookID)
	if err != nil {
		return Note{}, errors.New("筆記本不存在")
	}
	note, err := s.GetNote(ctx, id)
	if err != nil {
		return Note{}, errors.New("筆記不存在")
	}
	if note.StorageKind == storageKindDirectory || notebook.StorageKind == storageKindDirectory {
		if note.StorageKind != storageKindDirectory || notebook.StorageKind != storageKindDirectory {
			return Note{}, errors.New("不支援一般筆記與直接管理筆記之間的移動")
		}
		return s.moveManagedNote(ctx, note, notebook)
	}
	now := nowMillis()
	result, err := s.db.ExecContext(ctx, `UPDATE notes SET notebook_id = ?, updated_at = ? WHERE id = ?`, notebookID, now, id)
	if err != nil {
		return Note{}, err
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return Note{}, errors.New("筆記不存在")
	}
	return s.GetNote(ctx, id)
}

func (s *Store) SetNotePinned(ctx context.Context, id string, pinned bool) error {
	result, err := s.db.ExecContext(ctx, `UPDATE notes SET is_pinned = ? WHERE id = ?`, boolInt(pinned), id)
	if err != nil {
		return err
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return errors.New("筆記不存在")
	}
	return nil
}

func (s *Store) SetNoteTodo(
	ctx context.Context,
	id string,
	isTodo bool,
	todoDue int64,
	todoCompleted int64,
) error {
	result, err := s.db.ExecContext(ctx,
		`UPDATE notes SET is_todo = ?, todo_due = ?, todo_completed = ?, updated_at = ? WHERE id = ?`,
		boolInt(isTodo), todoDue, todoCompleted, nowMillis(), id,
	)
	if err != nil {
		return err
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return errors.New("筆記不存在")
	}
	return nil
}

func (s *Store) TrashNote(ctx context.Context, id string) error {
	note, err := s.GetNote(ctx, id)
	if err != nil {
		return errors.New("筆記不存在")
	}
	if note.StorageKind == storageKindDirectory {
		return s.recycleManagedNote(ctx, note)
	}
	now := nowMillis()
	result, err := s.db.ExecContext(ctx, `UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?`, now, now, id)
	if err != nil {
		return err
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return errors.New("筆記不存在")
	}
	return nil
}

func (s *Store) RestoreNote(ctx context.Context, id string) error {
	now := nowMillis()
	_, err := s.db.ExecContext(ctx, `UPDATE notes SET deleted_at = 0, updated_at = ? WHERE id = ?`, now, id)
	return err
}

func (s *Store) DeleteNotePermanently(ctx context.Context, id string) error {
	note, noteErr := s.GetNote(ctx, id)
	if noteErr == nil && note.StorageKind == storageKindDirectory {
		return s.recycleManagedNote(ctx, note)
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `SELECT id FROM resources WHERE note_id = ?`, id)
	if err != nil {
		return err
	}
	resourceIDs := make([]string, 0)
	for rows.Next() {
		var resourceID string
		if err := rows.Scan(&resourceID); err != nil {
			rows.Close()
			return err
		}
		resourceIDs = append(resourceIDs, resourceID)
	}
	rows.Close()
	if _, err := tx.ExecContext(ctx, `DELETE FROM notes_fts WHERE note_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM notes WHERE id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM resources WHERE note_id = ?`, id); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	for _, resourceID := range resourceIDs {
		_ = os.Remove(s.resourcePath(resourceID))
	}
	return nil
}

func (s *Store) SearchNotes(ctx context.Context, search string, limit int) ([]NoteSummary, error) {
	if limit <= 0 {
		limit = 100
	}
	query := strings.TrimSpace(search)
	if query == "" {
		page, err := s.ListNotes(ctx, NoteQuery{View: "all", Limit: limit})
		return page.Items, err
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT n.id, n.notebook_id, f.title, n.title, n.body, n.is_todo, n.todo_due,
		        n.todo_completed, n.is_conflict, n.is_pinned, n.created_at, n.updated_at, n.deleted_at,
		        (SELECT COUNT(*) FROM resources r WHERE r.note_id = n.id), n.storage_kind
		 FROM notes_fts
		 JOIN notes n ON n.id = notes_fts.note_id
		 JOIN notebooks f ON f.id = n.notebook_id
		 WHERE notes_fts MATCH ? AND n.deleted_at = 0
		 ORDER BY n.is_pinned DESC, bm25(notes_fts), n.updated_at DESC
		 LIMIT ?`,
		ftsQuery(query), limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]NoteSummary, 0)
	for rows.Next() {
		var item NoteSummary
		var body string
		var isTodo, isConflict, isPinned int
		if err := rows.Scan(
			&item.ID, &item.NotebookID, &item.NotebookTitle, &item.Title, &body,
			&isTodo, &item.TodoDue, &item.TodoCompleted, &isConflict, &isPinned,
			&item.CreatedAt, &item.UpdatedAt, &item.DeletedAt, &item.AttachmentCount,
			&item.StorageKind,
		); err != nil {
			return nil, err
		}
		item.IsTodo = isTodo != 0
		item.IsConflict = isConflict != 0
		item.IsPinned = isPinned != 0
		item.Snippet = noteSnippet(body, 180)
		item.Tags, _ = s.noteTags(ctx, item.ID)
		items = append(items, item)
	}
	return items, rows.Err()
}

func ftsQuery(value string) string {
	fields := strings.Fields(value)
	for index, field := range fields {
		fields[index] = `"` + strings.ReplaceAll(field, `"`, `""`) + `"*`
	}
	return strings.Join(fields, " AND ")
}

func (s *Store) noteTags(ctx context.Context, noteID string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT t.title FROM tags t JOIN note_tags nt ON nt.tag_id = t.id
		 WHERE nt.note_id = ? ORDER BY t.title COLLATE NOCASE`,
		noteID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tags := make([]string, 0)
	for rows.Next() {
		var title string
		if err := rows.Scan(&title); err != nil {
			return nil, err
		}
		tags = append(tags, title)
	}
	return tags, rows.Err()
}

func (s *Store) ListTags(ctx context.Context) ([]Tag, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT t.id, t.title, COUNT(nt.note_id)
		 FROM tags t LEFT JOIN note_tags nt ON nt.tag_id = t.id
		 LEFT JOIN notes n ON n.id = nt.note_id AND n.deleted_at = 0
		 GROUP BY t.id, t.title
		 HAVING COUNT(n.id) > 0
		 ORDER BY t.title COLLATE NOCASE`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Tag, 0)
	for rows.Next() {
		var item Tag
		if err := rows.Scan(&item.ID, &item.Title, &item.Count); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) SetNoteTags(ctx context.Context, noteID string, tagTitles []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM note_tags WHERE note_id = ?`, noteID); err != nil {
		return err
	}
	now := nowMillis()
	seen := map[string]bool{}
	for _, rawTitle := range tagTitles {
		title := strings.TrimSpace(strings.TrimPrefix(rawTitle, "#"))
		if title == "" || seen[strings.ToLower(title)] {
			continue
		}
		seen[strings.ToLower(title)] = true
		var tagID string
		err := tx.QueryRowContext(ctx, `SELECT id FROM tags WHERE title = ? COLLATE NOCASE`, title).Scan(&tagID)
		if errors.Is(err, sql.ErrNoRows) {
			tagID = newID()
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO tags(id, title, created_at, updated_at) VALUES(?, ?, ?, ?)`,
				tagID, title, now, now,
			); err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT OR IGNORE INTO note_tags(note_id, tag_id, created_at) VALUES(?, ?, ?)`,
			noteID, tagID, now,
		); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `UPDATE notes SET updated_at = ? WHERE id = ?`, now, noteID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx,
		`DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)`,
	); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) noteResources(ctx context.Context, noteID string) ([]Resource, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, note_id, title, mime, filename, file_size, storage_kind, external_path, created_at, updated_at
		 FROM resources WHERE note_id = ? ORDER BY created_at`,
		noteID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Resource, 0)
	for rows.Next() {
		var item Resource
		if err := rows.Scan(
			&item.ID, &item.NoteID, &item.Title, &item.Mime, &item.Filename,
			&item.FileSize, &item.StorageKind, &item.ExternalPath,
			&item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		item.Filename = normalizeResourceFilename(item.Filename, item.Title, item.Mime, "")
		item.URL = "/resources/" + item.ID
		item.StoragePath = s.resourceStoragePath(item, noteID)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) AddResource(ctx context.Context, noteID string, sourcePath string) (Resource, error) {
	stat, err := os.Stat(sourcePath)
	if err != nil {
		return Resource{}, err
	}
	if stat.IsDir() {
		return Resource{}, errors.New("不能附加資料夾")
	}
	if stat.Size() == 0 {
		return Resource{}, errors.New("附件不可為空")
	}
	note, err := s.GetNote(ctx, noteID)
	if err != nil {
		return Resource{}, err
	}
	if note.StorageKind == storageKindDirectory {
		return s.addManagedResourceFile(ctx, note, sourcePath)
	}
	id := newID()
	mime := detectMime(sourcePath)
	title := strings.TrimSuffix(filepath.Base(sourcePath), filepath.Ext(sourcePath))
	_ = note
	dest := s.resourcePath(id)
	if err := copyFile(sourcePath, dest); err != nil {
		return Resource{}, err
	}
	now := nowMillis()
	item := Resource{
		ID: id, NoteID: noteID, Title: title, Mime: mime, Filename: filepath.Base(sourcePath),
		FileSize: stat.Size(), URL: "/resources/" + id, StorageKind: storageKindDatabase,
		CreatedAt: now, UpdatedAt: now,
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO resources(id, note_id, title, mime, filename, file_size, created_at, updated_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
		item.ID, item.NoteID, item.Title, item.Mime, item.Filename, item.FileSize, item.CreatedAt, item.UpdatedAt,
	)
	if err != nil {
		_ = os.Remove(dest)
		return Resource{}, err
	}
	return item, nil
}

func (s *Store) AddResourceData(ctx context.Context, noteID string, filename string, data []byte) (Resource, error) {
	if len(data) == 0 {
		return Resource{}, errors.New("附件不可為空")
	}
	if len(data) > maxUploadFileBytes {
		return Resource{}, errors.New("附件不可超過 50 MB")
	}
	note, err := s.GetNote(ctx, noteID)
	if err != nil {
		return Resource{}, errors.New("筆記不存在")
	}
	if note.StorageKind == storageKindDirectory {
		return s.addManagedResourceData(ctx, note, filename, data)
	}
	filename = filepath.Base(strings.ReplaceAll(strings.TrimSpace(filename), `\`, "/"))
	if filename == "." || filename == "" {
		filename = "attachment"
	}
	id := newID()
	dest := s.resourcePath(id)
	if dest == "" {
		return Resource{}, errors.New("無效的附件 ID")
	}
	temp, err := os.CreateTemp(s.resourcesDir, ".upload-*")
	if err != nil {
		return Resource{}, err
	}
	tempPath := temp.Name()
	keepTemp := false
	defer func() {
		_ = temp.Close()
		if !keepTemp {
			_ = os.Remove(tempPath)
		}
	}()
	if _, err := temp.Write(data); err != nil {
		return Resource{}, err
	}
	if err := temp.Sync(); err != nil {
		return Resource{}, err
	}
	if err := temp.Close(); err != nil {
		return Resource{}, err
	}
	if err := os.Rename(tempPath, dest); err != nil {
		return Resource{}, err
	}
	keepTemp = true

	now := nowMillis()
	item := Resource{
		ID: id, NoteID: noteID, Title: strings.TrimSuffix(filename, filepath.Ext(filename)),
		Mime: detectMimeData(filename, data), Filename: filename, FileSize: int64(len(data)),
		URL: "/resources/" + id, StorageKind: storageKindDatabase, CreatedAt: now, UpdatedAt: now,
	}
	if _, err := s.db.ExecContext(ctx,
		`INSERT INTO resources(id, note_id, title, mime, filename, file_size, created_at, updated_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
		item.ID, item.NoteID, item.Title, item.Mime, item.Filename, item.FileSize, item.CreatedAt, item.UpdatedAt,
	); err != nil {
		_ = os.Remove(dest)
		return Resource{}, err
	}
	return item, nil
}

func (s *Store) Resource(ctx context.Context, id string) (Resource, error) {
	var item Resource
	err := s.db.QueryRowContext(ctx,
		`SELECT id, note_id, title, mime, filename, file_size, storage_kind, external_path, created_at, updated_at
		 FROM resources WHERE id = ?`,
		id,
	).Scan(
		&item.ID, &item.NoteID, &item.Title, &item.Mime, &item.Filename, &item.FileSize,
		&item.StorageKind, &item.ExternalPath, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return item, err
	}
	item.Filename = normalizeResourceFilename(item.Filename, item.Title, item.Mime, "")
	item.URL = "/resources/" + item.ID
	item.StoragePath = s.resourceStoragePath(item, item.NoteID)
	return item, nil
}

func (s *Store) resourceStoragePath(resource Resource, noteID string) string {
	if resource.StorageKind != storageKindDirectory || resource.ExternalPath == "" {
		return ""
	}
	var notePath string
	if err := s.db.QueryRow(`SELECT external_path FROM notes WHERE id = ?`, noteID).Scan(&notePath); err != nil {
		return ""
	}
	relative, err := filepath.Rel(filepath.Dir(notePath), resource.ExternalPath)
	if err != nil {
		return ""
	}
	return filepath.ToSlash(relative)
}

func (s *Store) resourcePath(id string) string {
	if id == "" || strings.ContainsAny(id, `/\`) || id == "." || id == ".." {
		return ""
	}
	return filepath.Join(s.resourcesDir, id)
}

func (s *Store) storedResourcePath(resource Resource) string {
	if resource.StorageKind == storageKindDirectory && resource.ExternalPath != "" {
		return resource.ExternalPath
	}
	return s.resourcePath(resource.ID)
}

func (s *Store) GetSetting(ctx context.Context, key string) (string, bool, error) {
	var value string
	err := s.db.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return value, err == nil, err
}

func (s *Store) SetSetting(ctx context.Context, key string, value string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO settings(key, value, updated_at) VALUES(?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		key, value, nowMillis(),
	)
	return err
}

func (s *Store) Settings(ctx context.Context) (map[string]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	values := map[string]string{}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		values[key] = value
	}
	return values, rows.Err()
}
