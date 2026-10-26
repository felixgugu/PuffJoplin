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

const resourceCleanupGracePeriod = time.Minute

var resourceCleanupReferencePattern = regexp.MustCompile(
	`(?:/resources/|:/)([A-Za-z0-9]{32})`,
)

type cleanupResourceRecord struct {
	StorageKind string
	CreatedAt   int64
}

func (s *Store) CleanupUnusedResources(ctx context.Context) (ResourceCleanupReport, error) {
	references, err := s.resourceCleanupReferences(ctx)
	if err != nil {
		return ResourceCleanupReport{}, err
	}

	records, err := s.resourceCleanupRecords(ctx)
	if err != nil {
		return ResourceCleanupReport{}, err
	}

	report := ResourceCleanupReport{}
	cutoff := time.Now().Add(-resourceCleanupGracePeriod)
	for id, record := range records {
		if err := ctx.Err(); err != nil {
			return report, err
		}
		if record.StorageKind != storageKindDatabase || references[id] {
			continue
		}
		if record.CreatedAt > cutoff.UnixMilli() {
			report.SkippedRecent++
			continue
		}
		path := s.resourcePath(id)
		if path == "" {
			report.FailedCount++
			continue
		}
		info, statErr := os.Lstat(path)
		switch {
		case errors.Is(statErr, os.ErrNotExist):
			if err := s.deleteCleanupResourceRecord(ctx, id); err != nil {
				report.FailedCount++
				continue
			}
			report.RemovedIndexed++
			report.RemovedCount++
		case statErr != nil:
			report.FailedCount++
			continue
		case !info.Mode().IsRegular():
			report.FailedCount++
			continue
		case info.ModTime().After(cutoff):
			report.SkippedRecent++
			continue
		default:
			if err := os.Remove(path); err != nil {
				report.FailedCount++
				continue
			}
			report.FreedBytes += info.Size()
			if err := s.deleteCleanupResourceRecord(ctx, id); err != nil {
				report.FailedCount++
				continue
			}
			report.RemovedIndexed++
			report.RemovedCount++
		}
	}

	entries, err := os.ReadDir(s.resourcesDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return report, nil
		}
		return report, err
	}
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return report, err
		}
		if entry.IsDir() || entry.Type()&os.ModeSymlink != 0 {
			continue
		}
		name := entry.Name()
		if _, indexed := records[name]; indexed || resourceCleanupFileReferenced(name, references) {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			report.FailedCount++
			continue
		}
		if !info.Mode().IsRegular() {
			continue
		}
		if info.ModTime().After(cutoff) {
			report.SkippedRecent++
			continue
		}
		path := filepath.Join(s.resourcesDir, name)
		if err := os.Remove(path); err != nil {
			report.FailedCount++
			continue
		}
		report.RemovedOrphans++
		report.RemovedCount++
		report.FreedBytes += info.Size()
	}
	return report, nil
}

func (s *Store) resourceCleanupReferences(ctx context.Context) (map[string]bool, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT body FROM notes`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	references := make(map[string]bool)
	for rows.Next() {
		var body string
		if err := rows.Scan(&body); err != nil {
			return nil, err
		}
		for _, match := range resourceCleanupReferencePattern.FindAllStringSubmatch(body, -1) {
			if len(match) > 1 {
				references[match[1]] = true
			}
		}
	}
	return references, rows.Err()
}

func (s *Store) resourceCleanupRecords(
	ctx context.Context,
) (map[string]cleanupResourceRecord, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, storage_kind, created_at FROM resources`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := make(map[string]cleanupResourceRecord)
	for rows.Next() {
		var id string
		var record cleanupResourceRecord
		if err := rows.Scan(&id, &record.StorageKind, &record.CreatedAt); err != nil {
			return nil, err
		}
		records[id] = record
	}
	return records, rows.Err()
}

func (s *Store) deleteCleanupResourceRecord(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(
		ctx,
		`DELETE FROM resources WHERE id = ? AND storage_kind = ?`,
		id,
		storageKindDatabase,
	)
	return err
}

func resourceCleanupFileReferenced(name string, references map[string]bool) bool {
	if references[name] {
		return true
	}
	stem := strings.TrimSuffix(name, filepath.Ext(name))
	return stem != name && references[stem]
}
