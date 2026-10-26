package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"unicode"
)

const managedDirectoryExclusionsSetting = "managedDirectory.exclusions.v1"

func defaultManagedDirectoryExclusions() ManagedDirectoryExclusions {
	return ManagedDirectoryExclusions{
		FolderNames:       []string{},
		MarkdownFileNames: []string{},
	}
}

func normalizeManagedDirectoryExclusions(
	value ManagedDirectoryExclusions,
) (ManagedDirectoryExclusions, error) {
	normalized := defaultManagedDirectoryExclusions()
	var err error
	normalized.FolderNames, err = normalizeExcludedNames(value.FolderNames, false)
	if err != nil {
		return ManagedDirectoryExclusions{}, err
	}
	normalized.MarkdownFileNames, err = normalizeExcludedNames(value.MarkdownFileNames, true)
	if err != nil {
		return ManagedDirectoryExclusions{}, err
	}
	return normalized, nil
}

func normalizeExcludedNames(values []string, markdown bool) ([]string, error) {
	seen := make(map[string]bool, len(values))
	names := make([]string, 0, len(values))
	for _, raw := range values {
		name := strings.TrimSpace(raw)
		if name == "" {
			return nil, errors.New("排除名稱不可為空")
		}
		if name == "." || name == ".." {
			return nil, errors.New("排除名稱不可為 . 或 ..")
		}
		if strings.ContainsAny(name, `/\`) || filepath.Base(name) != name {
			return nil, fmt.Errorf("「%s」不可包含路徑分隔符號", name)
		}
		if strings.IndexFunc(name, unicode.IsControl) >= 0 {
			return nil, fmt.Errorf("「%s」包含不支援的控制字元", name)
		}
		if len([]rune(name)) > 255 {
			return nil, fmt.Errorf("「%s」超過 255 個字元", name)
		}
		if markdown && !strings.HasSuffix(name, ".md") {
			return nil, fmt.Errorf("「%s」必須是完整且以 .md 結尾的檔名", name)
		}
		if seen[name] {
			continue
		}
		seen[name] = true
		names = append(names, name)
	}
	sort.Strings(names)
	if len(names) > 500 {
		return nil, errors.New("每種排除清單最多可有 500 個名稱")
	}
	return names, nil
}

func (s *Store) GetManagedDirectoryExclusions(
	ctx context.Context,
) (ManagedDirectoryExclusions, error) {
	raw, exists, err := s.GetSetting(ctx, managedDirectoryExclusionsSetting)
	if err != nil {
		return ManagedDirectoryExclusions{}, err
	}
	if !exists || strings.TrimSpace(raw) == "" {
		return defaultManagedDirectoryExclusions(), nil
	}
	var value ManagedDirectoryExclusions
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return ManagedDirectoryExclusions{}, fmt.Errorf("讀取直接管理筆記本排除設定: %w", err)
	}
	return normalizeManagedDirectoryExclusions(value)
}

func (s *Store) loadManagedDirectoryExclusions(
	ctx context.Context,
) (ManagedDirectoryExclusions, error) {
	return s.GetManagedDirectoryExclusions(ctx)
}

func validateManagedRootExclusionNames(
	roots []Notebook,
	exclusions ManagedDirectoryExclusions,
) error {
	rootNames := make(map[string]bool, len(roots))
	for _, root := range roots {
		rootNames[filepath.Base(filepath.Clean(root.StorageRoot))] = true
	}
	for _, name := range exclusions.FolderNames {
		if rootNames[name] {
			return fmt.Errorf("「%s」是目前管理根目錄的名稱，不能排除根目錄本身", name)
		}
	}
	return nil
}

func managedPathExcluded(
	root string,
	target string,
	isDirectory bool,
	exclusions ManagedDirectoryExclusions,
) bool {
	relative, err := filepath.Rel(filepath.Clean(root), filepath.Clean(target))
	if err != nil || relative == "." || relative == "" ||
		relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return false
	}
	folderNames := make(map[string]bool, len(exclusions.FolderNames))
	for _, name := range exclusions.FolderNames {
		folderNames[name] = true
	}
	parts := strings.Split(filepath.ToSlash(relative), "/")
	limit := len(parts)
	if !isDirectory {
		limit--
	}
	for index := 0; index < limit; index++ {
		if folderNames[parts[index]] {
			return true
		}
	}
	if isDirectory {
		return false
	}
	for _, name := range exclusions.MarkdownFileNames {
		if parts[len(parts)-1] == name {
			return true
		}
	}
	return false
}

func (s *Store) ApplyManagedDirectoryExclusions(
	ctx context.Context,
	value ManagedDirectoryExclusions,
) (ManagedDirectoryExclusionReport, error) {
	exclusions, err := normalizeManagedDirectoryExclusions(value)
	if err != nil {
		return ManagedDirectoryExclusionReport{}, err
	}
	roots, err := s.ListManagedRoots(ctx)
	if err != nil {
		return ManagedDirectoryExclusionReport{}, err
	}
	if err := validateManagedRootExclusionNames(roots, exclusions); err != nil {
		return ManagedDirectoryExclusionReport{}, err
	}
	beforeNotes, beforeNotebooks, err := s.excludedManagedIDs(ctx)
	if err != nil {
		return ManagedDirectoryExclusionReport{}, err
	}
	encoded, err := json.Marshal(exclusions)
	if err != nil {
		return ManagedDirectoryExclusionReport{}, err
	}
	if err := s.SetSetting(ctx, managedDirectoryExclusionsSetting, string(encoded)); err != nil {
		return ManagedDirectoryExclusionReport{}, err
	}

	report := ManagedDirectoryExclusionReport{
		Exclusions:    exclusions,
		RootCount:     len(roots),
		HiddenNoteIDs: []string{},
		Warnings:      []ImportWarning{},
	}
	for _, root := range roots {
		if _, refreshErr := s.reindexManagedDirectory(ctx, root.ID, root.StorageRoot); refreshErr != nil {
			report.Warnings = append(report.Warnings, ImportWarning{
				Item: root.StorageRoot, Message: refreshErr.Error(),
			})
		}
	}
	afterNotes, afterNotebooks, err := s.excludedManagedIDs(ctx)
	if err != nil {
		return report, err
	}
	for id := range afterNotes {
		if !beforeNotes[id] {
			report.HiddenNotes++
		}
		report.HiddenNoteIDs = append(report.HiddenNoteIDs, id)
	}
	for id := range beforeNotes {
		if !afterNotes[id] {
			report.RestoredNotes++
		}
	}
	for id := range afterNotebooks {
		if !beforeNotebooks[id] {
			report.HiddenNotebooks++
		}
	}
	for id := range beforeNotebooks {
		if !afterNotebooks[id] {
			report.RestoredNotebooks++
		}
	}
	sort.Strings(report.HiddenNoteIDs)
	return report, nil
}

func (s *Store) excludedManagedIDs(
	ctx context.Context,
) (map[string]bool, map[string]bool, error) {
	noteRows, err := s.db.QueryContext(ctx,
		`SELECT n.id
		 FROM notes n
		 JOIN notebooks nb ON nb.id = n.notebook_id
		 WHERE n.is_excluded = 1 AND n.storage_kind = ?`,
		storageKindDirectory,
	)
	if err != nil {
		return nil, nil, err
	}
	notes := make(map[string]bool)
	for noteRows.Next() {
		var id string
		if err := noteRows.Scan(&id); err != nil {
			noteRows.Close()
			return nil, nil, err
		}
		notes[id] = true
	}
	if err := noteRows.Close(); err != nil {
		return nil, nil, err
	}
	if err := noteRows.Err(); err != nil {
		return nil, nil, err
	}

	notebookRows, err := s.db.QueryContext(ctx,
		`SELECT id FROM notebooks WHERE is_excluded = 1 AND storage_kind = ?`,
		storageKindDirectory,
	)
	if err != nil {
		return nil, nil, err
	}
	notebooks := make(map[string]bool)
	for notebookRows.Next() {
		var id string
		if err := notebookRows.Scan(&id); err != nil {
			notebookRows.Close()
			return nil, nil, err
		}
		notebooks[id] = true
	}
	if err := notebookRows.Close(); err != nil {
		return nil, nil, err
	}
	return notes, notebooks, notebookRows.Err()
}
