package main

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"mime"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	storageKindDatabase  = "database"
	storageKindDirectory = "directory"
	managedImagesDir     = "images"
	maxManagedMarkdown   = 64 << 20
)

var managedMarkdownResourcePattern = regexp.MustCompile(`!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)`)
var managedResourceURLPattern = regexp.MustCompile(`(?:/resources/|:/)([A-Za-z0-9]{32})`)

type managedDirectoryEntry struct {
	RelativePath string
	AbsolutePath string
	Title        string
	ModTime      int64
}

type managedMarkdownEntry struct {
	RelativePath string
	AbsolutePath string
	NotebookPath string
	Title        string
	Body         string
	ModTime      int64
	Size         int64
}

type managedDirectoryScan struct {
	Directories []managedDirectoryEntry
	Notes       []managedMarkdownEntry
	Warnings    []ImportWarning
	Skipped     int
}

func normalizeManagedRoot(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", errors.New("未選擇資料夾")
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	absolute = filepath.Clean(absolute)
	resolved, err := filepath.EvalSymlinks(absolute)
	if err != nil {
		return "", fmt.Errorf("無法讀取資料夾: %w", err)
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", errors.New("選擇的路徑不是資料夾")
	}
	return filepath.Clean(resolved), nil
}

func scanManagedDirectory(root string) (managedDirectoryScan, error) {
	scan := managedDirectoryScan{
		Directories: make([]managedDirectoryEntry, 0),
		Notes:       make([]managedMarkdownEntry, 0),
		Warnings:    make([]ImportWarning, 0),
	}
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			scan.Skipped++
			scan.Warnings = append(scan.Warnings, ImportWarning{Item: path, Message: walkErr.Error()})
			if entry != nil && entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			scan.Skipped++
			scan.Warnings = append(scan.Warnings, ImportWarning{Item: path, Message: "略過符號連結"})
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		relativePath, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		if relativePath == "." {
			relativePath = ""
		} else {
			relativePath = filepath.ToSlash(relativePath)
		}
		if entry.IsDir() {
			if relativePath != "" && strings.EqualFold(filepath.Base(path), managedImagesDir) {
				return filepath.SkipDir
			}
			info, err := entry.Info()
			if err != nil {
				scan.Skipped++
				scan.Warnings = append(scan.Warnings, ImportWarning{Item: path, Message: err.Error()})
				return nil
			}
			title := filepath.Base(path)
			if relativePath == "" {
				title = filepath.Base(root)
			}
			scan.Directories = append(scan.Directories, managedDirectoryEntry{
				RelativePath: relativePath,
				AbsolutePath: path,
				Title:        title,
				ModTime:      info.ModTime().UnixMilli(),
			})
			return nil
		}
		if !entry.Type().IsRegular() || !strings.EqualFold(filepath.Ext(entry.Name()), ".md") {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			scan.Skipped++
			scan.Warnings = append(scan.Warnings, ImportWarning{Item: path, Message: err.Error()})
			return nil
		}
		if info.Size() > maxManagedMarkdown {
			scan.Skipped++
			scan.Warnings = append(scan.Warnings, ImportWarning{Item: path, Message: "Markdown 檔案超過 64 MB"})
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			scan.Skipped++
			scan.Warnings = append(scan.Warnings, ImportWarning{Item: path, Message: err.Error()})
			return nil
		}
		if !utf8.Valid(data) {
			scan.Skipped++
			scan.Warnings = append(scan.Warnings, ImportWarning{Item: path, Message: "檔案不是有效 UTF-8"})
			return nil
		}
		data = bytes.TrimPrefix(data, []byte{0xef, 0xbb, 0xbf})
		notebookPath := filepath.ToSlash(filepath.Dir(relativePath))
		if notebookPath == "." {
			notebookPath = ""
		}
		scan.Notes = append(scan.Notes, managedMarkdownEntry{
			RelativePath: relativePath,
			AbsolutePath: path,
			NotebookPath: notebookPath,
			Title:        strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name())),
			Body:         string(data),
			ModTime:      info.ModTime().UnixMilli(),
			Size:         info.Size(),
		})
		return nil
	})
	if err != nil {
		return managedDirectoryScan{}, err
	}
	sort.Slice(scan.Directories, func(i, j int) bool {
		return scan.Directories[i].RelativePath < scan.Directories[j].RelativePath
	})
	sort.Slice(scan.Notes, func(i, j int) bool {
		return scan.Notes[i].RelativePath < scan.Notes[j].RelativePath
	})
	return scan, nil
}

func (s *Store) RegisterManagedDirectory(ctx context.Context, rootPath string) (ManagedDirectoryReport, error) {
	root, err := normalizeManagedRoot(rootPath)
	if err != nil {
		return ManagedDirectoryReport{}, err
	}
	roots, err := s.ListManagedRoots(ctx)
	if err != nil {
		return ManagedDirectoryReport{}, err
	}
	var rootID string
	for _, existing := range roots {
		if strings.EqualFold(filepath.Clean(existing.StorageRoot), root) {
			rootID = existing.ID
			break
		}
		if pathWithinRoot(existing.StorageRoot, root) || pathWithinRoot(root, existing.StorageRoot) {
			return ManagedDirectoryReport{}, errors.New("此資料夾與已管理的 Markdown 目錄重疊")
		}
	}
	createdRoot := rootID == ""
	if createdRoot {
		now := nowMillis()
		rootID = newID()
		_, err = s.db.ExecContext(ctx,
			`INSERT INTO notebooks(id, parent_id, title, icon, sort_order, storage_kind, storage_root, storage_path, created_at, updated_at)
			 VALUES(?, '', ?, '', 0, ?, ?, '', ?, ?)`,
			rootID, filepath.Base(root), storageKindDirectory, root, now, now,
		)
	}
	if err != nil {
		return ManagedDirectoryReport{}, err
	}
	report, err := s.reindexManagedDirectory(ctx, rootID, root)
	if err != nil && createdRoot {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM notebooks WHERE id = ?`, rootID)
	}
	return report, err
}

func (s *Store) RefreshManagedDirectory(ctx context.Context, notebookID string) (ManagedDirectoryReport, error) {
	notebook, err := s.getNotebook(ctx, notebookID)
	if err != nil {
		return ManagedDirectoryReport{}, errors.New("筆記本不存在")
	}
	if notebook.StorageKind != storageKindDirectory {
		return ManagedDirectoryReport{}, errors.New("此筆記本不是直接管理的資料夾")
	}
	rootID, rootPath, err := s.managedRoot(ctx, notebook)
	if err != nil {
		return ManagedDirectoryReport{}, err
	}
	return s.reindexManagedDirectory(ctx, rootID, rootPath)
}

func (s *Store) managedRoot(ctx context.Context, notebook Notebook) (string, string, error) {
	if notebook.StorageKind != storageKindDirectory {
		return "", "", errors.New("此筆記本不是直接管理的資料夾")
	}
	var id, root string
	err := s.db.QueryRowContext(ctx,
		`SELECT id, storage_root FROM notebooks
		 WHERE storage_kind = ? AND storage_path = '' AND storage_root = ? COLLATE NOCASE`,
		storageKindDirectory, notebook.StorageRoot,
	).Scan(&id, &root)
	if err != nil {
		return "", "", errors.New("管理中的根資料夾不存在")
	}
	return id, root, nil
}

func (s *Store) ListManagedRoots(ctx context.Context) ([]Notebook, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, parent_id, title, icon, sort_order, storage_kind, storage_root, storage_path, created_at, updated_at
		 FROM notebooks
		 WHERE storage_kind = ? AND storage_path = ''
		 ORDER BY title COLLATE NOCASE`,
		storageKindDirectory,
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

func (s *Store) reindexManagedDirectory(ctx context.Context, rootID string, rootPath string) (ManagedDirectoryReport, error) {
	scan, err := scanManagedDirectory(rootPath)
	if err != nil {
		return ManagedDirectoryReport{
			NotebookID: rootID,
			RootPath:   rootPath,
			Warnings:   []ImportWarning{{Item: rootPath, Message: err.Error()}},
		}, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ManagedDirectoryReport{}, err
	}
	defer tx.Rollback()

	existingNotebooks, err := managedNotebooksByPath(ctx, tx, rootPath)
	if err != nil {
		return ManagedDirectoryReport{}, err
	}
	dirIDs := make(map[string]string, len(scan.Directories))
	dirIDs[""] = rootID
	seenNotebookPaths := map[string]bool{"": true}
	for _, directory := range scan.Directories {
		parentID := ""
		if directory.RelativePath != "" {
			parentID = rootID
			parentPath := filepath.ToSlash(filepath.Dir(directory.RelativePath))
			if parentPath == "." {
				parentPath = ""
			}
			parentID = dirIDs[parentPath]
		}
		id := existingNotebooks[strings.ToLower(directory.RelativePath)]
		if id == "" {
			id = newID()
		}
		dirIDs[directory.RelativePath] = id
		seenNotebookPaths[strings.ToLower(directory.RelativePath)] = true
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO notebooks(id, parent_id, title, icon, sort_order, storage_kind, storage_root, storage_path, created_at, updated_at)
			 VALUES(?, ?, ?, '', 0, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			   parent_id = excluded.parent_id,
			   title = excluded.title,
			   storage_kind = excluded.storage_kind,
			   storage_root = excluded.storage_root,
			   storage_path = excluded.storage_path,
			   updated_at = excluded.updated_at`,
			id, parentID, directory.Title, storageKindDirectory, rootPath, directory.RelativePath,
			directory.ModTime, directory.ModTime,
		); err != nil {
			return ManagedDirectoryReport{}, err
		}
	}

	existingNotes, err := managedNotesByPath(ctx, tx, rootID)
	if err != nil {
		return ManagedDirectoryReport{}, err
	}
	noteIDs := make(map[string]bool, len(scan.Notes))
	resourceCount := 0
	for _, note := range scan.Notes {
		noteID := existingNotes[strings.ToLower(note.AbsolutePath)]
		if noteID == "" {
			noteID = newID()
		}
		noteIDs[noteID] = true
		notebookID := dirIDs[note.NotebookPath]
		if notebookID == "" {
			notebookID = rootID
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO notes(id, notebook_id, title, body, is_todo, todo_due, todo_completed,
			 source_url, author, is_conflict, is_pinned, sort_order, storage_kind, external_path,
			 external_mtime, external_size, created_at, updated_at, deleted_at)
			 VALUES(?, ?, ?, ?, 0, 0, 0, '', '', 0, 0, 0, ?, ?, ?, ?, ?, ?, 0)
			 ON CONFLICT(id) DO UPDATE SET
			   notebook_id = excluded.notebook_id,
			   title = excluded.title,
			   body = excluded.body,
			   storage_kind = excluded.storage_kind,
			   external_path = excluded.external_path,
			   external_mtime = excluded.external_mtime,
			   external_size = excluded.external_size,
			   updated_at = excluded.updated_at`,
			noteID, notebookID, note.Title, note.Body, storageKindDirectory, note.AbsolutePath,
			note.ModTime, note.Size, note.ModTime, note.ModTime,
		); err != nil {
			return ManagedDirectoryReport{}, err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM notes_fts WHERE note_id = ?`, noteID); err != nil {
			return ManagedDirectoryReport{}, err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO notes_fts(note_id, title, body) VALUES(?, ?, ?)`, noteID, note.Title, note.Body); err != nil {
			return ManagedDirectoryReport{}, err
		}
		count, err := s.syncManagedResources(ctx, tx, noteID, note.AbsolutePath, note.Body)
		if err != nil {
			return ManagedDirectoryReport{}, err
		}
		resourceCount += count
	}

	for path, noteID := range existingNotes {
		if noteIDs[noteID] {
			continue
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM notes_fts WHERE note_id = ?`, noteID); err != nil {
			return ManagedDirectoryReport{}, err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM resources WHERE note_id = ?`, noteID); err != nil {
			return ManagedDirectoryReport{}, err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM notes WHERE id = ?`, noteID); err != nil {
			return ManagedDirectoryReport{}, err
		}
		delete(existingNotes, path)
	}

	for path, notebookID := range existingNotebooks {
		if seenNotebookPaths[path] {
			continue
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM notebooks WHERE id = ?`, notebookID); err != nil {
			return ManagedDirectoryReport{}, err
		}
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)`); err != nil {
		return ManagedDirectoryReport{}, err
	}
	if err := tx.Commit(); err != nil {
		return ManagedDirectoryReport{}, err
	}
	return ManagedDirectoryReport{
		NotebookID: rootID,
		RootPath:   rootPath,
		Notebooks:  max(0, len(scan.Directories)-1),
		Notes:      len(scan.Notes),
		Resources:  resourceCount,
		Skipped:    scan.Skipped,
		Warnings:   scan.Warnings,
	}, nil
}

func managedNotebooksByPath(ctx context.Context, tx *sql.Tx, rootPath string) (map[string]string, error) {
	rows, err := tx.QueryContext(ctx,
		`SELECT id, storage_path FROM notebooks
		 WHERE storage_kind = ? AND storage_root = ? COLLATE NOCASE`,
		storageKindDirectory, rootPath,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make(map[string]string)
	for rows.Next() {
		var id, relativePath string
		if err := rows.Scan(&id, &relativePath); err != nil {
			return nil, err
		}
		items[strings.ToLower(relativePath)] = id
	}
	return items, rows.Err()
}

func managedNotesByPath(ctx context.Context, tx *sql.Tx, rootID string) (map[string]string, error) {
	rows, err := tx.QueryContext(ctx,
		`SELECT n.id, n.external_path
		 FROM notes n
		 JOIN notebooks nb ON nb.id = n.notebook_id
		 WHERE n.storage_kind = ? AND nb.storage_root = (
		   SELECT storage_root FROM notebooks WHERE id = ?
		 )`,
		storageKindDirectory, rootID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make(map[string]string)
	for rows.Next() {
		var id, externalPath string
		if err := rows.Scan(&id, &externalPath); err != nil {
			return nil, err
		}
		items[strings.ToLower(filepath.Clean(externalPath))] = id
	}
	return items, rows.Err()
}

func (s *Store) syncManagedResources(ctx context.Context, tx *sql.Tx, noteID string, notePath string, body string) (int, error) {
	resources, err := managedResourceReferences(notePath, body)
	if err != nil {
		return 0, err
	}
	deleteQuery := `DELETE FROM resources WHERE note_id = ? AND storage_kind = ?`
	deleteArgs := []any{noteID, storageKindDirectory}
	if len(resources) > 0 {
		placeholders := strings.TrimSuffix(strings.Repeat("?,", len(resources)), ",")
		deleteQuery += ` AND external_path NOT IN (` + placeholders + `)`
		for _, resourcePath := range resources {
			deleteArgs = append(deleteArgs, resourcePath)
		}
	}
	if _, err := tx.ExecContext(ctx, deleteQuery, deleteArgs...); err != nil {
		return 0, err
	}
	for _, resourcePath := range resources {
		info, err := os.Stat(resourcePath)
		if err != nil || !info.Mode().IsRegular() {
			continue
		}
		filename := filepath.Base(resourcePath)
		mimeType := mime.TypeByExtension(filepath.Ext(filename))
		if mimeType == "" {
			mimeType = detectMime(filename)
		}
		now := nowMillis()
		var resourceID string
		err = tx.QueryRowContext(ctx,
			`SELECT id FROM resources WHERE note_id = ? AND external_path = ? COLLATE NOCASE`,
			noteID, resourcePath,
		).Scan(&resourceID)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			resourceID = newID()
			_, err = tx.ExecContext(ctx,
				`INSERT INTO resources(id, note_id, title, mime, filename, file_size, storage_kind, external_path, created_at, updated_at)
				 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				resourceID, noteID, strings.TrimSuffix(filename, filepath.Ext(filename)), mimeType,
				filename, info.Size(), storageKindDirectory, resourcePath, now, info.ModTime().UnixMilli(),
			)
		case err == nil:
			_, err = tx.ExecContext(ctx,
				`UPDATE resources SET mime = ?, filename = ?, file_size = ?, updated_at = ?
				 WHERE id = ?`,
				mimeType, filename, info.Size(), info.ModTime().UnixMilli(), resourceID,
			)
		}
		if err != nil {
			return 0, err
		}
	}
	return len(resources), nil
}

func managedResourceReferences(notePath string, body string) ([]string, error) {
	paths := make(map[string]bool)
	for _, match := range managedMarkdownResourcePattern.FindAllStringSubmatch(body, -1) {
		target := ""
		if len(match) > 1 {
			target = match[1]
		}
		if target == "" && len(match) > 2 {
			target = match[2]
		}
		realPath, ok := resolveManagedResourcePath(notePath, target)
		if !ok {
			continue
		}
		paths[realPath] = true
	}
	items := make([]string, 0, len(paths))
	for path := range paths {
		items = append(items, path)
	}
	sort.Strings(items)
	return items, nil
}

func pathWithinRoot(root string, target string) bool {
	relative, err := filepath.Rel(filepath.Clean(root), filepath.Clean(target))
	if err != nil {
		return false
	}
	return relative == "." || (relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator)))
}

func managedNotebookDirectory(notebook Notebook) string {
	if notebook.StorageKind != storageKindDirectory {
		return ""
	}
	return filepath.Join(notebook.StorageRoot, filepath.FromSlash(notebook.StoragePath))
}

func (s *Store) unregisterManagedDirectory(ctx context.Context, notebook Notebook) error {
	if notebook.StorageKind != storageKindDirectory || notebook.StoragePath != "" {
		return errors.New("只能停止管理最上層資料夾")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx,
		`SELECT id FROM notebooks WHERE storage_kind = ? AND storage_root = ? COLLATE NOCASE`,
		storageKindDirectory, notebook.StorageRoot,
	)
	if err != nil {
		return err
	}
	ids := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if len(ids) == 0 {
		return errors.New("筆記本不存在")
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, len(ids))
	for index, id := range ids {
		args[index] = id
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM notes_fts WHERE note_id IN (
		SELECT id FROM notes WHERE notebook_id IN (`+placeholders+`)
	)`, args...); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM resources WHERE note_id IN (
		SELECT id FROM notes WHERE notebook_id IN (`+placeholders+`)
	)`, args...); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM notes WHERE notebook_id IN (`+placeholders+`)`, args...); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM notebooks WHERE storage_kind = ? AND storage_root = ? COLLATE NOCASE`, storageKindDirectory, notebook.StorageRoot); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)`); err != nil {
		return err
	}
	return tx.Commit()
}

func managedFileMtime(path string) (int64, int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, 0, err
	}
	return info.ModTime().UnixMilli(), info.Size(), nil
}

func writeManagedMarkdown(path string, body string) (int64, int64, error) {
	directory := filepath.Dir(path)
	temp, err := os.CreateTemp(directory, ".puffjoplin-*.tmp")
	if err != nil {
		return 0, 0, err
	}
	tempPath := temp.Name()
	keep := false
	defer func() {
		_ = temp.Close()
		if !keep {
			_ = os.Remove(tempPath)
		}
	}()
	if _, err := temp.WriteString(body); err != nil {
		return 0, 0, err
	}
	if err := temp.Sync(); err != nil {
		return 0, 0, err
	}
	if err := temp.Close(); err != nil {
		return 0, 0, err
	}
	if err := os.Rename(tempPath, path); err != nil {
		return 0, 0, err
	}
	keep = true
	mtime, size, err := managedFileMtime(path)
	if err != nil {
		return 0, 0, err
	}
	return mtime, size, nil
}

func uniqueManagedFilename(directory string, filename string) string {
	extension := filepath.Ext(filename)
	base := strings.TrimSuffix(filename, extension)
	candidate := filename
	for index := 2; ; index++ {
		if _, err := os.Stat(filepath.Join(directory, candidate)); errors.Is(err, os.ErrNotExist) {
			return candidate
		}
		candidate = fmt.Sprintf("%s (%d)%s", base, index, extension)
	}
}

func sanitizeManagedFilename(value string, fallback string) string {
	value = strings.TrimSpace(value)
	replacer := strings.NewReplacer(
		"\\", "-", "/", "-", ":", "-", "*", "-", "?", "-", "\"", "-",
		"<", "-", ">", "-", "|", "-",
	)
	value = strings.Trim(replacer.Replace(value), " .")
	if value == "" {
		value = fallback
	}
	return value
}

func managedTimestamp(value time.Time) int64 {
	return value.UnixMilli()
}

func (s *Store) refreshManagedNote(ctx context.Context, note Note) (Note, error) {
	if note.StorageKind != storageKindDirectory || note.ExternalPath == "" {
		return note, nil
	}
	info, err := os.Stat(note.ExternalPath)
	if err != nil {
		return note, errors.New("Markdown 檔案目前無法存取")
	}
	if !info.Mode().IsRegular() {
		return note, errors.New("Markdown 路徑不是檔案")
	}
	if info.Size() > maxManagedMarkdown {
		return note, errors.New("Markdown 檔案超過 64 MB")
	}
	data, err := os.ReadFile(note.ExternalPath)
	if err != nil {
		return note, err
	}
	if !utf8.Valid(data) {
		return note, errors.New("Markdown 檔案不是有效 UTF-8")
	}
	data = bytes.TrimPrefix(data, []byte{0xef, 0xbb, 0xbf})
	body := string(data)
	title := strings.TrimSuffix(filepath.Base(note.ExternalPath), filepath.Ext(note.ExternalPath))
	mtime := info.ModTime().UnixMilli()
	size := info.Size()
	if note.Body == body && note.Title == title &&
		note.ExternalMTime == mtime && note.ExternalSize == size {
		return note, nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return note, err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx,
		`UPDATE notes SET title = ?, body = ?, external_mtime = ?, external_size = ?, updated_at = ?
		 WHERE id = ? AND storage_kind = ?`,
		title, body, mtime, size, mtime, note.ID, storageKindDirectory,
	); err != nil {
		return note, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM notes_fts WHERE note_id = ?`, note.ID); err != nil {
		return note, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO notes_fts(note_id, title, body) VALUES(?, ?, ?)`, note.ID, title, body); err != nil {
		return note, err
	}
	if _, err := s.syncManagedResources(ctx, tx, note.ID, note.ExternalPath, body); err != nil {
		return note, err
	}
	if err := tx.Commit(); err != nil {
		return note, err
	}
	note.Title = title
	note.Body = body
	note.ExternalMTime = mtime
	note.ExternalSize = size
	note.UpdatedAt = mtime
	return note, nil
}

func (s *Store) createManagedNote(ctx context.Context, notebook Notebook, title string, body string) (Note, error) {
	directory := managedNotebookDirectory(notebook)
	if info, err := os.Stat(directory); err != nil || !info.IsDir() {
		return Note{}, errors.New("筆記本資料夾目前無法存取")
	}
	title = sanitizeManagedFilename(title, "未命名筆記")
	filename := uniqueManagedFilename(directory, title+".md")
	path := filepath.Join(directory, filename)
	body, err := s.managedResourceBodyForDisk(ctx, "", body)
	if err != nil {
		return Note{}, err
	}
	mtime, size, err := writeManagedMarkdown(path, body)
	if err != nil {
		return Note{}, err
	}
	now := nowMillis()
	note := Note{
		ID: newID(), NotebookID: notebook.ID, StorageKind: storageKindDirectory,
		ExternalPath: path, Title: strings.TrimSuffix(filename, filepath.Ext(filename)),
		Body: body, ExternalMTime: mtime, ExternalSize: size,
		CreatedAt: now, UpdatedAt: mtime, Tags: []string{}, Resources: []Resource{},
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Note{}, err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO notes(id, notebook_id, title, body, is_todo, todo_due, todo_completed,
		 source_url, author, is_conflict, is_pinned, sort_order, storage_kind, external_path,
		 external_mtime, external_size, created_at, updated_at, deleted_at)
		 VALUES(?, ?, ?, ?, 0, 0, 0, '', '', 0, 0, 0, ?, ?, ?, ?, ?, ?, 0)`,
		note.ID, note.NotebookID, note.Title, note.Body, storageKindDirectory,
		note.ExternalPath, note.ExternalMTime, note.ExternalSize, note.CreatedAt, note.UpdatedAt,
	); err != nil {
		return Note{}, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO notes_fts(note_id, title, body) VALUES(?, ?, ?)`, note.ID, note.Title, note.Body); err != nil {
		return Note{}, err
	}
	return note, tx.Commit()
}

func (s *Store) updateManagedNote(ctx context.Context, existing Note, input NoteInput) (Note, error) {
	targetNotebook, err := s.getNotebook(ctx, input.NotebookID)
	if err != nil || targetNotebook.StorageKind != storageKindDirectory {
		return Note{}, errors.New("不能將直接管理的筆記改到一般筆記本")
	}
	currentNotebook, err := s.getNotebook(ctx, existing.NotebookID)
	if err != nil || !strings.EqualFold(currentNotebook.StorageRoot, targetNotebook.StorageRoot) {
		return Note{}, errors.New("請使用移動筆記功能變更資料夾")
	}
	mtime, size, err := managedFileMtime(existing.ExternalPath)
	if err != nil {
		return Note{}, errors.New("Markdown 檔案目前無法存取")
	}
	if mtime != existing.ExternalMTime || size != existing.ExternalSize {
		return Note{}, errors.New("Markdown 檔案已被外部程式修改，請重新載入後再儲存")
	}
	title := sanitizeManagedFilename(input.Title, strings.TrimSuffix(filepath.Base(existing.ExternalPath), filepath.Ext(existing.ExternalPath)))
	directory := filepath.Dir(existing.ExternalPath)
	targetPath := filepath.Join(directory, title+".md")
	if !strings.EqualFold(targetPath, existing.ExternalPath) {
		targetPath = filepath.Join(directory, uniqueManagedFilename(directory, title+".md"))
	}
	body, err := s.managedResourceBodyForDisk(ctx, existing.ID, input.Body)
	if err != nil {
		return Note{}, err
	}
	newMTime, newSize, err := writeManagedMarkdown(targetPath, body)
	if err != nil {
		return Note{}, err
	}
	if !strings.EqualFold(targetPath, existing.ExternalPath) {
		if err := os.Remove(existing.ExternalPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			return Note{}, err
		}
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Note{}, err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx,
		`UPDATE notes SET notebook_id = ?, title = ?, body = ?, is_todo = ?, todo_due = ?,
		        todo_completed = ?, source_url = ?, author = ?, external_path = ?,
		        external_mtime = ?, external_size = ?, updated_at = ?
		 WHERE id = ? AND storage_kind = ?`,
		input.NotebookID, strings.TrimSuffix(filepath.Base(targetPath), filepath.Ext(targetPath)),
		body, boolInt(input.IsTodo), input.TodoDue, input.TodoCompleted,
		input.SourceURL, input.Author, targetPath, newMTime, newSize, newMTime,
		existing.ID, storageKindDirectory,
	); err != nil {
		return Note{}, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM notes_fts WHERE note_id = ?`, existing.ID); err != nil {
		return Note{}, err
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO notes_fts(note_id, title, body) VALUES(?, ?, ?)`,
		existing.ID, strings.TrimSuffix(filepath.Base(targetPath), filepath.Ext(targetPath)), body,
	); err != nil {
		return Note{}, err
	}
	if _, err := s.syncManagedResources(ctx, tx, existing.ID, targetPath, body); err != nil {
		return Note{}, err
	}
	if err := tx.Commit(); err != nil {
		return Note{}, err
	}
	return s.GetNote(ctx, existing.ID)
}

func (s *Store) moveManagedNote(ctx context.Context, note Note, targetNotebook Notebook) (Note, error) {
	sourceNotebook, err := s.getNotebook(ctx, note.NotebookID)
	if err != nil || targetNotebook.StorageKind != storageKindDirectory {
		return Note{}, errors.New("不能將直接管理的筆記移到一般筆記本")
	}
	if !strings.EqualFold(sourceNotebook.StorageRoot, targetNotebook.StorageRoot) {
		return Note{}, errors.New("目前只允許在同一個直接管理根目錄內移動筆記")
	}
	if sourceNotebook.ID == targetNotebook.ID {
		return note, nil
	}
	targetDirectory := managedNotebookDirectory(targetNotebook)
	if info, err := os.Stat(targetDirectory); err != nil || !info.IsDir() {
		return Note{}, errors.New("目的筆記本資料夾目前無法存取")
	}
	body := note.Body
	resourcePaths, err := managedResourceReferences(note.ExternalPath, body)
	if err != nil {
		return Note{}, err
	}
	if len(resourcePaths) > 0 {
		movedResources := make(map[string]string, len(resourcePaths))
		imagesDirectory := filepath.Join(targetDirectory, managedImagesDir)
		if err := os.MkdirAll(imagesDirectory, 0o755); err != nil {
			return Note{}, err
		}
		for _, resourcePath := range resourcePaths {
			newFilename := uniqueManagedFilename(imagesDirectory, filepath.Base(resourcePath))
			if err := copyFile(resourcePath, filepath.Join(imagesDirectory, newFilename)); err != nil {
				return Note{}, err
			}
			newRelative := filepath.ToSlash(filepath.Join(managedImagesDir, newFilename))
			movedResources[strings.ToLower(filepath.Clean(resourcePath))] = newRelative
		}
		body = rewriteManagedResourceDestinations(note.ExternalPath, body, movedResources)
	}
	basename := filepath.Base(note.ExternalPath)
	basename = uniqueManagedFilename(targetDirectory, basename)
	targetPath := filepath.Join(targetDirectory, basename)
	mtime, size, err := writeManagedMarkdown(targetPath, body)
	if err != nil {
		return Note{}, err
	}
	if err := os.Remove(note.ExternalPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return Note{}, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Note{}, err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx,
		`UPDATE notes SET notebook_id = ?, title = ?, body = ?, external_path = ?,
		 external_mtime = ?, external_size = ?, updated_at = ? WHERE id = ?`,
		targetNotebook.ID, strings.TrimSuffix(basename, filepath.Ext(basename)), body,
		targetPath, mtime, size, mtime, note.ID,
	); err != nil {
		return Note{}, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM notes_fts WHERE note_id = ?`, note.ID); err != nil {
		return Note{}, err
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO notes_fts(note_id, title, body) VALUES(?, ?, ?)`,
		note.ID, strings.TrimSuffix(basename, filepath.Ext(basename)), body,
	); err != nil {
		return Note{}, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM resources WHERE note_id = ? AND storage_kind = ?`, note.ID, storageKindDirectory); err != nil {
		return Note{}, err
	}
	if _, err := s.syncManagedResources(ctx, tx, note.ID, targetPath, body); err != nil {
		return Note{}, err
	}
	if err := tx.Commit(); err != nil {
		return Note{}, err
	}
	return s.GetNote(ctx, note.ID)
}

func (s *Store) recycleManagedNote(ctx context.Context, note Note) error {
	if err := recycleManagedFile(note.ExternalPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM notes_fts WHERE note_id = ?`, note.ID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM resources WHERE note_id = ?`, note.ID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM notes WHERE id = ?`, note.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) managedResourceBodyForDisk(ctx context.Context, noteID string, body string) (string, error) {
	if noteID == "" {
		return body, nil
	}
	var firstErr error
	body = managedResourceURLPattern.ReplaceAllStringFunc(body, func(value string) string {
		if firstErr != nil {
			return value
		}
		match := managedResourceURLPattern.FindStringSubmatch(value)
		if len(match) != 2 {
			return value
		}
		resource, err := s.Resource(ctx, match[1])
		if err != nil || resource.NoteID != noteID || resource.StorageKind != storageKindDirectory {
			return value
		}
		firstErr = err
		if resource.StoragePath != "" {
			return (&url.URL{Path: resource.StoragePath}).EscapedPath()
		}
		return value
	})
	return body, firstErr
}

func rewriteManagedResourceDestinations(
	notePath string,
	body string,
	replacements map[string]string,
) string {
	return managedMarkdownResourcePattern.ReplaceAllStringFunc(body, func(match string) string {
		groups := managedMarkdownResourcePattern.FindStringSubmatch(match)
		if len(groups) < 3 {
			return match
		}
		target := groups[1]
		angleWrapped := target != ""
		if target == "" {
			target = groups[2]
		}
		absolutePath, ok := resolveManagedResourcePath(notePath, target)
		if !ok {
			return match
		}
		replacement := replacements[strings.ToLower(filepath.Clean(absolutePath))]
		if replacement == "" {
			return match
		}
		oldDestination := target
		newDestination := (&url.URL{Path: replacement}).EscapedPath()
		if angleWrapped {
			oldDestination = "<" + target + ">"
			newDestination = "<" + newDestination + ">"
		}
		return strings.Replace(match, oldDestination, newDestination, 1)
	})
}

func resolveManagedResourcePath(notePath string, target string) (string, bool) {
	target = strings.TrimSpace(strings.Trim(target, "<>"))
	if target == "" || strings.HasPrefix(target, "#") ||
		strings.HasPrefix(target, "/") || strings.Contains(target, "://") ||
		strings.HasPrefix(strings.ToLower(target), "data:") ||
		strings.HasPrefix(strings.ToLower(target), "file:") {
		return "", false
	}
	decoded, err := url.PathUnescape(target)
	if err != nil {
		decoded = target
	}
	noteDir := filepath.Clean(filepath.Dir(notePath))
	imagesRoot, err := filepath.Abs(filepath.Join(noteDir, managedImagesDir))
	if err != nil {
		return "", false
	}
	absolute, err := filepath.Abs(filepath.Clean(filepath.Join(noteDir, filepath.FromSlash(decoded))))
	if err != nil || !pathWithinRoot(imagesRoot, absolute) {
		return "", false
	}
	realPath, err := filepath.EvalSymlinks(absolute)
	if err != nil || !pathWithinRoot(imagesRoot, realPath) {
		return "", false
	}
	return realPath, true
}

func (s *Store) addManagedResourceData(ctx context.Context, note Note, filename string, data []byte) (Resource, error) {
	if len(data) == 0 {
		return Resource{}, errors.New("附件不可為空")
	}
	if len(data) > maxUploadFileBytes {
		return Resource{}, errors.New("附件不可超過 50 MB")
	}
	imagesDirectory := filepath.Join(filepath.Dir(note.ExternalPath), managedImagesDir)
	if err := os.MkdirAll(imagesDirectory, 0o755); err != nil {
		return Resource{}, err
	}
	filename = sanitizeManagedFilename(filepath.Base(strings.ReplaceAll(strings.TrimSpace(filename), `\`, "/")), "attachment")
	filename = uniqueManagedFilename(imagesDirectory, filename)
	path := filepath.Join(imagesDirectory, filename)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return Resource{}, err
	}
	now := nowMillis()
	item := Resource{
		ID: newID(), NoteID: note.ID, Title: strings.TrimSuffix(filename, filepath.Ext(filename)),
		Mime: detectMimeData(filename, data), Filename: filename, FileSize: int64(len(data)),
		URL: "/resources/", StorageKind: storageKindDirectory, ExternalPath: path,
		StoragePath: filepath.ToSlash(filepath.Join(managedImagesDir, filename)),
		CreatedAt:   now, UpdatedAt: now,
	}
	item.URL += item.ID
	if _, err := s.db.ExecContext(ctx,
		`INSERT INTO resources(id, note_id, title, mime, filename, file_size, storage_kind, external_path, created_at, updated_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		item.ID, item.NoteID, item.Title, item.Mime, item.Filename, item.FileSize,
		item.StorageKind, item.ExternalPath, item.CreatedAt, item.UpdatedAt,
	); err != nil {
		_ = os.Remove(path)
		return Resource{}, err
	}
	return item, nil
}

func (s *Store) addManagedResourceFile(ctx context.Context, note Note, sourcePath string) (Resource, error) {
	stat, err := os.Stat(sourcePath)
	if err != nil {
		return Resource{}, err
	}
	if !stat.Mode().IsRegular() {
		return Resource{}, errors.New("附件不是檔案")
	}
	if stat.Size() == 0 {
		return Resource{}, errors.New("附件不可為空")
	}
	if stat.Size() > maxUploadFileBytes {
		return Resource{}, errors.New("附件不可超過 50 MB")
	}
	data, err := os.ReadFile(sourcePath)
	if err != nil {
		return Resource{}, err
	}
	return s.addManagedResourceData(ctx, note, filepath.Base(sourcePath), data)
}
