package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestManagedDirectoryIndexesMarkdownAndIgnoresOtherFiles(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	root := filepath.Join(t.TempDir(), "Vault")
	if err := os.MkdirAll(filepath.Join(root, "Projects", "images"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "Home.md"), []byte("# Home"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "Projects", "Plan.MD"), []byte("Plan"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "ignore.markdown"), []byte("ignore"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "notes.txt"), []byte("ignore"), 0o644); err != nil {
		t.Fatal(err)
	}

	report, err := store.RegisterManagedDirectory(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	if report.Notes != 2 || report.Notebooks != 1 {
		t.Fatalf("unexpected report: %#v", report)
	}
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	managed := make([]Notebook, 0)
	for _, notebook := range notebooks {
		if notebook.StorageKind == storageKindDirectory {
			managed = append(managed, notebook)
		}
	}
	if len(managed) != 2 {
		t.Fatalf("expected root and child notebooks, got %#v", managed)
	}
	page, err := store.ListNotes(ctx, NoteQuery{View: "notebook", NotebookID: report.NotebookID})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 2 {
		t.Fatalf("expected recursive note count 2, got %#v", page)
	}
	for _, note := range page.Items {
		if note.StorageKind != storageKindDirectory {
			t.Fatalf("unexpected note storage kind: %#v", note)
		}
		if strings.Contains(note.Title, "ignore") || strings.Contains(note.Title, "notes") {
			t.Fatalf("non-markdown file was indexed: %#v", note)
		}
	}

	extraPath := filepath.Join(root, "Projects", "Extra.md")
	if err := os.WriteFile(extraPath, []byte("Extra"), 0o644); err != nil {
		t.Fatal(err)
	}
	report, err = store.RefreshManagedDirectory(ctx, report.NotebookID)
	if err != nil || report.Notes != 3 {
		t.Fatalf("refresh after create = %#v, %v", report, err)
	}
	if err := os.Remove(extraPath); err != nil {
		t.Fatal(err)
	}
	report, err = store.RefreshManagedDirectory(ctx, report.NotebookID)
	if err != nil || report.Notes != 2 {
		t.Fatalf("refresh after delete = %#v, %v", report, err)
	}
}

func TestManagedDirectoryRejectsOverlappingRoots(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	root := filepath.Join(t.TempDir(), "Vault")
	child := filepath.Join(root, "Child")
	if err := os.MkdirAll(child, 0o755); err != nil {
		t.Fatal(err)
	}
	if _, err := store.RegisterManagedDirectory(ctx, root); err != nil {
		t.Fatal(err)
	}
	if _, err := store.RegisterManagedDirectory(ctx, child); err == nil ||
		!strings.Contains(err.Error(), "重疊") {
		t.Fatalf("expected overlapping root rejection, got %v", err)
	}
}

func TestManagedRootUnregisterKeepsFilesOnDisk(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	root := filepath.Join(t.TempDir(), "Vault")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	notePath := filepath.Join(root, "Keep me.md")
	if err := os.WriteFile(notePath, []byte("keep"), 0o644); err != nil {
		t.Fatal(err)
	}
	report, err := store.RegisterManagedDirectory(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteNotebook(ctx, report.NotebookID, false); err != nil {
		t.Fatal(err)
	}
	if data, err := os.ReadFile(notePath); err != nil || string(data) != "keep" {
		t.Fatalf("unregister removed markdown: %q, %v", data, err)
	}
	roots, err := store.ListManagedRoots(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 0 {
		t.Fatalf("managed root remains registered: %#v", roots)
	}
}

func TestManagedNotePersistsBodyTitleImagesAndDetectsExternalConflict(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	root := filepath.Join(t.TempDir(), "Vault")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	report, err := store.RegisterManagedDirectory(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	note, err := store.CreateNote(ctx, report.NotebookID, "First", "hello")
	if err != nil {
		t.Fatal(err)
	}
	if note.StorageKind != storageKindDirectory || note.ExternalPath == "" {
		t.Fatalf("unexpected managed note: %#v", note)
	}
	if data, err := os.ReadFile(note.ExternalPath); err != nil || string(data) != "hello" {
		t.Fatalf("created markdown = %q, %v", data, err)
	}

	resource, err := store.AddResourceData(ctx, note.ID, "photo 1.png", []byte("\x89PNG\r\n\x1a\nimage"))
	if err != nil {
		t.Fatal(err)
	}
	expectedImage := filepath.Join(root, "images", "photo 1.png")
	if resource.ExternalPath != expectedImage {
		t.Fatalf("resource path = %q, want %q", resource.ExternalPath, expectedImage)
	}
	if _, err := os.Stat(expectedImage); err != nil {
		t.Fatal(err)
	}
	attachment, err := store.AddResourceData(ctx, note.ID, "notes.txt", []byte("attachment"))
	if err != nil {
		t.Fatal(err)
	}

	input := noteInputFromNote(note)
	input.Title = "Renamed"
	input.Body = "![photo](:/" + resource.ID + ")\n\n[notes](/resources/" + attachment.ID + ")"
	updated, err := store.UpdateNote(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(updated.ExternalPath) != "Renamed.md" {
		t.Fatalf("renamed path = %q", updated.ExternalPath)
	}
	if _, err := os.Stat(note.ExternalPath); !os.IsNotExist(err) {
		t.Fatalf("old markdown still exists: %v", err)
	}
	data, err := os.ReadFile(updated.ExternalPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "![photo](images/photo%201.png)\n\n[notes](images/notes.txt)" {
		t.Fatalf("managed markdown should contain a relative image path, got %q", data)
	}
	if len(updated.Resources) != 2 {
		t.Fatalf("managed resources = %#v", updated.Resources)
	}
	input = noteInputFromNote(updated)
	input.Body = "image removed"
	updated, err = store.UpdateNote(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	if len(updated.Resources) != 0 {
		t.Fatalf("stale image resources remain indexed: %#v", updated.Resources)
	}

	if err := os.WriteFile(updated.ExternalPath, []byte("external change"), 0o644); err != nil {
		t.Fatal(err)
	}
	conflictInput := noteInputFromNote(updated)
	conflictInput.Body = "overwrite"
	if _, err := store.UpdateNote(ctx, conflictInput); err == nil ||
		!strings.Contains(err.Error(), "外部程式修改") {
		t.Fatalf("expected external modification conflict, got %v", err)
	}
}

func TestManagedNoteMoveCopiesImagesAndRejectsCrossMode(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	root := filepath.Join(t.TempDir(), "Vault")
	if err := os.MkdirAll(filepath.Join(root, "Source"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "Destination"), 0o755); err != nil {
		t.Fatal(err)
	}
	_, err := store.RegisterManagedDirectory(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var source, destination Notebook
	for _, notebook := range notebooks {
		switch notebook.StoragePath {
		case "Source":
			source = notebook
		case "Destination":
			destination = notebook
		}
	}
	if source.ID == "" || destination.ID == "" {
		t.Fatalf("missing managed child notebooks: %#v", notebooks)
	}
	note, err := store.CreateNote(ctx, source.ID, "Move me", "body")
	if err != nil {
		t.Fatal(err)
	}
	unchanged, err := store.MoveNote(ctx, note.ID, source.ID)
	if err != nil || unchanged.ExternalPath != note.ExternalPath {
		t.Fatalf("same-notebook move changed file: %#v, %v", unchanged, err)
	}
	resource, err := store.AddResourceData(ctx, note.ID, "photo.png", []byte("\x89PNG\r\n\x1a\nimage"))
	if err != nil {
		t.Fatal(err)
	}
	input := noteInputFromNote(note)
	input.Body = "![photo](/resources/" + resource.ID + ")"
	note, err = store.UpdateNote(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	moved, err := store.MoveNote(ctx, note.ID, destination.ID)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Dir(moved.ExternalPath) != filepath.Join(root, "Destination") {
		t.Fatalf("unexpected moved path: %q", moved.ExternalPath)
	}
	movedImage := filepath.Join(root, "Destination", "images", "photo.png")
	if _, err := os.Stat(movedImage); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(moved.ExternalPath)
	if err != nil || !strings.Contains(string(data), "images/photo.png") {
		t.Fatalf("moved markdown = %q, %v", data, err)
	}

	dbNotebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var databaseNotebook Notebook
	for _, notebook := range dbNotebooks {
		if notebook.StorageKind == storageKindDatabase {
			databaseNotebook = notebook
			break
		}
	}
	if databaseNotebook.ID == "" {
		t.Fatal("missing database notebook")
	}
	if _, err := store.MoveNote(ctx, moved.ID, databaseNotebook.ID); err == nil {
		t.Fatal("expected cross-mode move to be rejected")
	}
}
