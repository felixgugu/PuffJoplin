package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestCleanupUnusedResourcesRemovesUnreferencedFilesOnly(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil || len(notebooks) == 0 {
		t.Fatalf("list notebooks: %v", err)
	}
	note, err := store.CreateNote(ctx, notebooks[0].ID, "Cleanup", "")
	if err != nil {
		t.Fatal(err)
	}

	colonReference, err := store.AddResourceData(ctx, note.ID, "colon.png", []byte("colon"))
	if err != nil {
		t.Fatal(err)
	}
	pathReference, err := store.AddResourceData(ctx, note.ID, "path.png", []byte("path"))
	if err != nil {
		t.Fatal(err)
	}
	unused, err := store.AddResourceData(ctx, note.ID, "unused.png", []byte("unused"))
	if err != nil {
		t.Fatal(err)
	}
	recent, err := store.AddResourceData(ctx, note.ID, "recent.png", []byte("recent"))
	if err != nil {
		t.Fatal(err)
	}

	trashNote, err := store.CreateNote(ctx, notebooks[0].ID, "Trash", "")
	if err != nil {
		t.Fatal(err)
	}
	trashResource, err := store.AddResourceData(ctx, trashNote.ID, "trash.png", []byte("trash"))
	if err != nil {
		t.Fatal(err)
	}
	trashInput := noteInputFromNote(trashNote)
	trashInput.Body = "![trash](:/" + trashResource.ID + ")"
	if _, err := store.UpdateNote(ctx, trashInput); err != nil {
		t.Fatal(err)
	}
	if err := store.TrashNote(ctx, trashNote.ID); err != nil {
		t.Fatal(err)
	}

	input := noteInputFromNote(note)
	unindexedReferencedID := strings.Repeat("a", 32)
	input.Body = "![colon](:/" + colonReference.ID +
		")\n\n[path](/resources/" + pathReference.ID +
		")\n\n[recover](:/" + unindexedReferencedID + ")"
	if _, err := store.UpdateNote(ctx, input); err != nil {
		t.Fatal(err)
	}

	makeOld := func(resource Resource) {
		t.Helper()
		old := time.Now().Add(-2 * time.Minute)
		if _, err := store.db.Exec(
			`UPDATE resources SET created_at = ?, updated_at = ? WHERE id = ?`,
			old.UnixMilli(),
			old.UnixMilli(),
			resource.ID,
		); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(store.resourcePath(resource.ID), old, old); err != nil {
			t.Fatal(err)
		}
	}
	for _, resource := range []Resource{
		colonReference,
		pathReference,
		unused,
		trashResource,
	} {
		makeOld(resource)
	}

	orphanPath := filepath.Join(store.resourcesDir, "orphan-file")
	if err := os.WriteFile(orphanPath, []byte("orphan"), 0o644); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-2 * time.Minute)
	if err := os.Chtimes(orphanPath, old, old); err != nil {
		t.Fatal(err)
	}
	unindexedReferencedPath := filepath.Join(store.resourcesDir, unindexedReferencedID)
	if err := os.WriteFile(unindexedReferencedPath, []byte("recover"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(unindexedReferencedPath, old, old); err != nil {
		t.Fatal(err)
	}
	recentOrphanPath := filepath.Join(store.resourcesDir, "recent-orphan")
	if err := os.WriteFile(recentOrphanPath, []byte("recent orphan"), 0o644); err != nil {
		t.Fatal(err)
	}

	managedRoot := filepath.Join(t.TempDir(), "Vault")
	if err := os.MkdirAll(managedRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	managedReport, err := store.RegisterManagedDirectory(ctx, managedRoot)
	if err != nil {
		t.Fatal(err)
	}
	managedNote, err := store.CreateNote(ctx, managedReport.NotebookID, "Managed", "")
	if err != nil {
		t.Fatal(err)
	}
	managedResource, err := store.AddResourceData(
		ctx,
		managedNote.ID,
		"managed.png",
		[]byte("managed"),
	)
	if err != nil {
		t.Fatal(err)
	}

	report, err := store.CleanupUnusedResources(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if report.RemovedCount != 2 || report.RemovedIndexed != 1 ||
		report.RemovedOrphans != 1 || report.FailedCount != 0 ||
		report.SkippedRecent != 2 {
		t.Fatalf("unexpected cleanup report: %#v", report)
	}
	expectedFreed := int64(len("unused") + len("orphan"))
	if report.FreedBytes != expectedFreed {
		t.Fatalf("freed bytes = %d, want %d", report.FreedBytes, expectedFreed)
	}

	for _, resource := range []Resource{
		colonReference,
		pathReference,
		trashResource,
		recent,
	} {
		if _, err := store.Resource(ctx, resource.ID); err != nil {
			t.Fatalf("referenced or recent resource %s was removed: %v", resource.ID, err)
		}
		if _, err := os.Stat(store.resourcePath(resource.ID)); err != nil {
			t.Fatalf("referenced or recent file %s was removed: %v", resource.ID, err)
		}
	}
	if _, err := store.Resource(ctx, unused.ID); err == nil {
		t.Fatal("unused resource record still exists")
	}
	if _, err := os.Stat(store.resourcePath(unused.ID)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("unused resource file still exists: %v", err)
	}
	if _, err := os.Stat(orphanPath); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("orphan file still exists: %v", err)
	}
	if _, err := os.Stat(unindexedReferencedPath); err != nil {
		t.Fatalf("referenced unindexed file was removed: %v", err)
	}
	if _, err := os.Stat(recentOrphanPath); err != nil {
		t.Fatalf("recent orphan file was removed: %v", err)
	}
	if _, err := store.Resource(ctx, managedResource.ID); err != nil {
		t.Fatalf("managed resource record was removed: %v", err)
	}
	if _, err := os.Stat(managedResource.ExternalPath); err != nil {
		t.Fatalf("managed external file was removed: %v", err)
	}
}

func TestCleanupUnusedResourcesRemovesStaleMissingRecord(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil || len(notebooks) == 0 {
		t.Fatalf("list notebooks: %v", err)
	}
	note, err := store.CreateNote(ctx, notebooks[0].ID, "Missing", "")
	if err != nil {
		t.Fatal(err)
	}
	resource, err := store.AddResourceData(ctx, note.ID, "missing.png", []byte("missing"))
	if err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-2 * time.Minute)
	if _, err := store.db.Exec(
		`UPDATE resources SET created_at = ? WHERE id = ?`,
		old.UnixMilli(),
		resource.ID,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(store.resourcePath(resource.ID)); err != nil {
		t.Fatal(err)
	}

	report, err := store.CleanupUnusedResources(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if report.RemovedCount != 1 || report.RemovedIndexed != 1 || report.FreedBytes != 0 {
		t.Fatalf("unexpected cleanup report: %#v", report)
	}
	if _, err := store.Resource(ctx, resource.ID); err == nil {
		t.Fatal("stale resource record still exists")
	}
}
