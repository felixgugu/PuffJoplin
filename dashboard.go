package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var dashboardImagePattern = regexp.MustCompile(
	`!\[[^\]]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))`,
)

func (s *Store) Dashboard(ctx context.Context, now time.Time) (DashboardSnapshot, error) {
	snapshot := DashboardSnapshot{
		GeneratedAt: now.UnixMilli(),
		Health: DashboardHealth{
			DataDir:      filepath.Dir(s.resourcesDir),
			ManagedRoots: []DashboardManagedRoot{},
		},
		Todos:     []DashboardTodo{},
		Recent:    []DashboardRecentNote{},
		Activity:  []DashboardActivityDay{},
		Notebooks: []DashboardNotebookStat{},
		Tags:      []Tag{},
	}

	if err := s.dashboardCounts(ctx, &snapshot.Counts); err != nil {
		return DashboardSnapshot{}, err
	}
	if err := s.dashboardTodos(ctx, &snapshot); err != nil {
		return DashboardSnapshot{}, err
	}
	if err := s.dashboardRecent(ctx, &snapshot); err != nil {
		return DashboardSnapshot{}, err
	}
	if err := s.dashboardActivity(ctx, now, &snapshot); err != nil {
		return DashboardSnapshot{}, err
	}
	if err := s.dashboardNotebooks(ctx, &snapshot); err != nil {
		return DashboardSnapshot{}, err
	}
	if err := s.dashboardTags(ctx, &snapshot); err != nil {
		return DashboardSnapshot{}, err
	}
	if err := s.dashboardMedia(ctx, now, &snapshot); err != nil {
		return DashboardSnapshot{}, err
	}
	if err := s.dashboardManagedRoots(ctx, &snapshot.Health.ManagedRoots); err != nil {
		return DashboardSnapshot{}, err
	}
	return snapshot, nil
}

func (s *Store) dashboardCounts(ctx context.Context, counts *DashboardCounts) error {
	if err := s.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN deleted_at = 0 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN deleted_at > 0 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN deleted_at = 0 AND is_todo = 1 AND todo_completed = 0 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN deleted_at = 0 AND is_todo = 1 AND todo_completed <> 0 THEN 1 ELSE 0 END), 0)
		FROM notes
		WHERE is_excluded = 0`,
	).Scan(
		&counts.ActiveNotes,
		&counts.TrashNotes,
		&counts.OpenTodos,
		&counts.CompletedTodos,
	); err != nil {
		return err
	}
	if err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM notebooks WHERE is_excluded = 0`,
	).Scan(&counts.Notebooks); err != nil {
		return err
	}
	return s.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM tags t
		WHERE EXISTS (
			SELECT 1
			FROM note_tags nt
			JOIN notes n ON n.id = nt.note_id
			WHERE nt.tag_id = t.id AND n.deleted_at = 0 AND n.is_excluded = 0
		)`,
	).Scan(&counts.Tags)
}

func (s *Store) dashboardTodos(ctx context.Context, snapshot *DashboardSnapshot) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT n.id, n.title, f.title, n.todo_due
		FROM notes n
		JOIN notebooks f ON f.id = n.notebook_id
		WHERE n.deleted_at = 0 AND n.is_excluded = 0 AND f.is_excluded = 0
		  AND n.is_todo = 1 AND n.todo_completed = 0
		ORDER BY CASE WHEN n.todo_due = 0 THEN 1 ELSE 0 END, n.todo_due, n.title COLLATE NOCASE
		LIMIT 24`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var item DashboardTodo
		if err := rows.Scan(&item.ID, &item.Title, &item.NotebookTitle, &item.TodoDue); err != nil {
			return err
		}
		snapshot.Todos = append(snapshot.Todos, item)
	}
	return rows.Err()
}

func (s *Store) dashboardRecent(ctx context.Context, snapshot *DashboardSnapshot) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT n.id, n.title, f.title, n.updated_at
		FROM notes n
		JOIN notebooks f ON f.id = n.notebook_id
		WHERE n.deleted_at = 0 AND n.is_excluded = 0 AND f.is_excluded = 0
		ORDER BY n.updated_at DESC, n.title COLLATE NOCASE
		LIMIT 16`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var item DashboardRecentNote
		if err := rows.Scan(&item.ID, &item.Title, &item.NotebookTitle, &item.UpdatedAt); err != nil {
			return err
		}
		snapshot.Recent = append(snapshot.Recent, item)
	}
	return rows.Err()
}

func (s *Store) dashboardActivity(
	ctx context.Context,
	now time.Time,
	snapshot *DashboardSnapshot,
) error {
	location := now.Location()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	firstDay := today.AddDate(0, 0, -27)
	index := make(map[string]int, 28)
	for offset := 0; offset < 28; offset++ {
		date := firstDay.AddDate(0, 0, offset).Format("2006-01-02")
		index[date] = len(snapshot.Activity)
		snapshot.Activity = append(snapshot.Activity, DashboardActivityDay{Date: date})
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT created_at, updated_at
		FROM notes
		WHERE deleted_at = 0 AND is_excluded = 0 AND (created_at >= ? OR updated_at >= ?)`,
		firstDay.UnixMilli(),
		firstDay.UnixMilli(),
	)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var created, updated int64
		if err := rows.Scan(&created, &updated); err != nil {
			return err
		}
		if position, ok := index[time.UnixMilli(created).In(location).Format("2006-01-02")]; ok {
			snapshot.Activity[position].Created++
		}
		if position, ok := index[time.UnixMilli(updated).In(location).Format("2006-01-02")]; ok {
			snapshot.Activity[position].Updated++
		}
	}
	return rows.Err()
}

func (s *Store) dashboardNotebooks(ctx context.Context, snapshot *DashboardSnapshot) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT f.id, f.title, f.storage_kind,
		       COUNT(n.id),
		       COALESCE(SUM(CASE WHEN n.is_todo = 1 AND n.todo_completed = 0 THEN 1 ELSE 0 END), 0)
		FROM notebooks f
		LEFT JOIN notes n ON n.notebook_id = f.id AND n.deleted_at = 0 AND n.is_excluded = 0
		WHERE f.is_excluded = 0
		GROUP BY f.id, f.title, f.storage_kind
		ORDER BY COUNT(n.id) DESC, f.title COLLATE NOCASE
		LIMIT 10`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var item DashboardNotebookStat
		if err := rows.Scan(
			&item.ID,
			&item.Title,
			&item.StorageKind,
			&item.NoteCount,
			&item.OpenTodoCount,
		); err != nil {
			return err
		}
		snapshot.Notebooks = append(snapshot.Notebooks, item)
	}
	return rows.Err()
}

func (s *Store) dashboardTags(ctx context.Context, snapshot *DashboardSnapshot) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT t.id, t.title, COUNT(DISTINCT n.id) AS note_count
		FROM tags t
		JOIN note_tags nt ON nt.tag_id = t.id
		JOIN notes n ON n.id = nt.note_id AND n.deleted_at = 0 AND n.is_excluded = 0
		GROUP BY t.id, t.title
		HAVING COUNT(DISTINCT n.id) > 0
		ORDER BY note_count DESC, t.title COLLATE NOCASE
		LIMIT 10`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var item Tag
		if err := rows.Scan(&item.ID, &item.Title, &item.Count); err != nil {
			return err
		}
		snapshot.Tags = append(snapshot.Tags, item)
	}
	return rows.Err()
}

func (s *Store) dashboardMedia(
	ctx context.Context,
	now time.Time,
	snapshot *DashboardSnapshot,
) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT r.id, r.mime, r.file_size, r.storage_kind, r.external_path
		FROM resources r
		JOIN notes n ON n.id = r.note_id
		WHERE n.is_excluded = 0`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id, mimeType, storageKind, externalPath string
		var fileSize int64
		if err := rows.Scan(&id, &mimeType, &fileSize, &storageKind, &externalPath); err != nil {
			rows.Close()
			return err
		}
		snapshot.Media.AttachmentCount++
		path := externalPath
		if storageKind != storageKindDirectory || path == "" {
			path = s.resourcePath(id)
		}
		info, statErr := os.Stat(path)
		if statErr != nil {
			if errors.Is(statErr, os.ErrNotExist) {
				snapshot.Media.MissingResourceCount++
			}
			snapshot.Media.AttachmentBytes += fileSize
		} else if info.Mode().IsRegular() {
			snapshot.Media.AttachmentBytes += info.Size()
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if err := rows.Err(); err != nil {
		return err
	}

	noteRows, err := s.db.QueryContext(ctx,
		`SELECT body FROM notes WHERE deleted_at = 0 AND is_excluded = 0`,
	)
	if err != nil {
		return err
	}
	for noteRows.Next() {
		var body string
		if err := noteRows.Scan(&body); err != nil {
			noteRows.Close()
			return err
		}
		snapshot.Media.ImageReferences += len(dashboardImagePattern.FindAllString(body, -1))
		snapshot.Media.MermaidDiagrams += dashboardMermaidCount(body)
	}
	if err := noteRows.Close(); err != nil {
		return err
	}
	if err := noteRows.Err(); err != nil {
		return err
	}

	references, err := s.resourceCleanupReferences(ctx)
	if err != nil {
		return err
	}
	records, err := s.resourceCleanupRecords(ctx)
	if err != nil {
		return err
	}
	cutoff := now.Add(-resourceCleanupGracePeriod)
	for id, record := range records {
		if record.StorageKind != storageKindDatabase || references[id] ||
			record.CreatedAt > cutoff.UnixMilli() {
			continue
		}
		path := s.resourcePath(id)
		info, statErr := os.Lstat(path)
		if statErr != nil || !info.Mode().IsRegular() || info.ModTime().After(cutoff) {
			continue
		}
		snapshot.Media.UnusedResourceCount++
		snapshot.Media.UnusedResourceBytes += info.Size()
	}
	entries, err := os.ReadDir(s.resourcesDir)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || entry.Type()&os.ModeSymlink != 0 {
			continue
		}
		name := entry.Name()
		if _, indexed := records[name]; indexed || resourceCleanupFileReferenced(name, references) {
			continue
		}
		info, infoErr := entry.Info()
		if infoErr != nil || !info.Mode().IsRegular() || info.ModTime().After(cutoff) {
			continue
		}
		snapshot.Media.UnusedResourceCount++
		snapshot.Media.UnusedResourceBytes += info.Size()
	}
	return nil
}

func (s *Store) dashboardManagedRoots(
	ctx context.Context,
	items *[]DashboardManagedRoot,
) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, title, storage_root
		FROM notebooks
		WHERE storage_kind = ? AND storage_path = '' AND is_excluded = 0
		ORDER BY title COLLATE NOCASE`,
		storageKindDirectory,
	)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var item DashboardManagedRoot
		if err := rows.Scan(&item.NotebookID, &item.Title, &item.Path); err != nil {
			return err
		}
		info, err := os.Stat(item.Path)
		item.Available = err == nil && info.IsDir()
		*items = append(*items, item)
	}
	return rows.Err()
}

func dashboardMermaidCount(markdown string) int {
	lines := strings.Split(markdown, "\n")
	type fence struct {
		character byte
		length    int
		mermaid   bool
	}
	var current *fence
	count := 0
	for _, line := range lines {
		trimmed := strings.TrimLeft(line, " ")
		if len(line)-len(trimmed) > 3 {
			continue
		}
		if current != nil {
			character := byte(0)
			length := 0
			if len(trimmed) >= 3 && (trimmed[0] == '`' || trimmed[0] == '~') {
				character = trimmed[0]
				for length < len(trimmed) && trimmed[length] == character {
					length++
				}
			}
			if character == current.character && length >= current.length &&
				strings.TrimSpace(trimmed[length:]) == "" {
				if current.mermaid {
					count++
				}
				current = nil
			}
			continue
		}
		if len(trimmed) < 3 || (trimmed[0] != '`' && trimmed[0] != '~') {
			continue
		}
		character := trimmed[0]
		length := 0
		for length < len(trimmed) && trimmed[length] == character {
			length++
		}
		if length < 3 {
			continue
		}
		language := strings.Fields(strings.TrimSpace(trimmed[length:]))
		current = &fence{
			character: character,
			length:    length,
			mermaid:   len(language) > 0 && strings.EqualFold(language[0], "mermaid"),
		}
	}
	return count
}
