package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDashboardAggregatesNotesMediaAndHealth(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil || len(notebooks) == 0 {
		t.Fatalf("list notebooks: %v", err)
	}
	note, err := store.CreateNote(ctx, notebooks[0].ID, "Dashboard note", "")
	if err != nil {
		t.Fatal(err)
	}
	image, err := store.AddResourceData(ctx, note.ID, "photo.png", []byte("\x89PNG\r\n\x1a\nimage"))
	if err != nil {
		t.Fatal(err)
	}
	input := noteInputFromNote(note)
	input.Body = "![photo](/resources/" + image.ID + ")\n\n```mermaid\nflowchart LR\n A --> B\n```"
	if _, err := store.UpdateNote(ctx, input); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 26, 12, 0, 0, 0, time.Local)
	if err := store.SetNoteTodo(ctx, note.ID, true, now.Add(-24*time.Hour).UnixMilli(), 0); err != nil {
		t.Fatal(err)
	}
	if err := store.SetNoteTags(ctx, note.ID, []string{"dashboard"}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.CreateNote(ctx, notebooks[0].ID, "Recent note", "recent"); err != nil {
		t.Fatal(err)
	}
	trash, err := store.CreateNote(ctx, notebooks[0].ID, "Trash note", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := store.TrashNote(ctx, trash.ID); err != nil {
		t.Fatal(err)
	}

	unused, err := store.AddResourceData(ctx, note.ID, "unused.txt", []byte("unused"))
	if err != nil {
		t.Fatal(err)
	}
	old := now.Add(-2 * time.Minute)
	if _, err := store.db.Exec(
		`UPDATE resources SET created_at = ? WHERE id = ?`,
		old.UnixMilli(),
		unused.ID,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(store.resourcePath(unused.ID), old, old); err != nil {
		t.Fatal(err)
	}
	missing, err := store.AddResourceData(ctx, note.ID, "missing.txt", []byte("missing"))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(store.resourcePath(missing.ID)); err != nil {
		t.Fatal(err)
	}

	root := filepath.Join(t.TempDir(), "Managed")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	managed, err := store.RegisterManagedDirectory(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	managedNote, err := store.CreateNote(ctx, managed.NotebookID, "Managed note", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.AddResourceData(ctx, managedNote.ID, "managed.png", []byte("image")); err != nil {
		t.Fatal(err)
	}

	snapshot, err := store.Dashboard(ctx, now)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Counts.ActiveNotes != 3 || snapshot.Counts.TrashNotes != 1 ||
		snapshot.Counts.OpenTodos != 1 {
		t.Fatalf("unexpected counts: %#v", snapshot.Counts)
	}
	if len(snapshot.Todos) != 1 || snapshot.Todos[0].ID != note.ID {
		t.Fatalf("unexpected todos: %#v", snapshot.Todos)
	}
	if len(snapshot.Tags) != 1 || snapshot.Tags[0].Title != "dashboard" {
		t.Fatalf("unexpected tags: %#v", snapshot.Tags)
	}
	if snapshot.Media.ImageReferences != 1 || snapshot.Media.MermaidDiagrams != 1 ||
		snapshot.Media.UnusedResourceCount != 1 ||
		snapshot.Media.MissingResourceCount != 1 ||
		snapshot.Media.AttachmentCount != 4 {
		t.Fatalf("unexpected media: %#v", snapshot.Media)
	}
	if len(snapshot.Health.ManagedRoots) != 1 || !snapshot.Health.ManagedRoots[0].Available {
		t.Fatalf("unexpected managed roots: %#v", snapshot.Health.ManagedRoots)
	}
	if len(snapshot.Activity) != 28 || len(snapshot.Recent) == 0 ||
		len(snapshot.Notebooks) == 0 {
		t.Fatalf("unexpected dashboard arrays: %#v", snapshot)
	}
}

func TestDashboardMermaidCount(t *testing.T) {
	markdown := "```ts\nnot a diagram\n```\n\n~~~mermaid\nflowchart LR\n A --> B\n~~~\n"
	if got := dashboardMermaidCount(markdown); got != 1 {
		t.Fatalf("mermaid count = %d", got)
	}
}

func TestDashboardRecentNotesUsesExtendedLimit(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil || len(notebooks) == 0 {
		t.Fatalf("list notebooks: %v", err)
	}
	for index := 0; index < 20; index++ {
		if _, err := store.CreateNote(
			ctx,
			notebooks[0].ID,
			"Recent "+string(rune('A'+index)),
			"",
		); err != nil {
			t.Fatal(err)
		}
	}
	snapshot, err := store.Dashboard(ctx, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Recent) != 16 {
		t.Fatalf("recent count = %d, want 16", len(snapshot.Recent))
	}
}
