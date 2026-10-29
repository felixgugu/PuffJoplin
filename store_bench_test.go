package main

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
)

func newBenchStore(b *testing.B, noteCount int) (*Store, string) {
	b.Helper()
	root := b.TempDir()
	store, err := OpenStore(filepath.Join(root, "bench.sqlite"), filepath.Join(root, "resources"))
	if err != nil {
		b.Fatalf("OpenStore: %v", err)
	}
	b.Cleanup(func() { store.Close() })
	ctx := context.Background()
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil || len(notebooks) == 0 {
		b.Fatalf("ListNotebooks: %v", err)
	}
	body := strings.Repeat(
		"## Heading with [a link](https://example.com/page) and ![image alt](img.png) text\n"+
			"- bullet **bold** and `code` with lorem ipsum dolor sit amet consectetur.\n",
		20,
	)
	now := nowMillis()
	tx, err := store.db.Begin()
	if err != nil {
		b.Fatal(err)
	}
	statement, err := tx.Prepare(`INSERT INTO notes(id, notebook_id, title, body, created_at, updated_at)
		VALUES(?, ?, ?, ?, ?, ?)`)
	if err != nil {
		b.Fatal(err)
	}
	for index := 0; index < noteCount; index++ {
		if _, err := statement.Exec(
			newID(), notebooks[0].ID, "Bench note", body, now-int64(index), now-int64(index),
		); err != nil {
			b.Fatal(err)
		}
	}
	if err := statement.Close(); err != nil {
		b.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		b.Fatal(err)
	}
	return store, notebooks[0].ID
}

func BenchmarkListNotes300(b *testing.B) {
	store, notebookID := newBenchStore(b, 5000)
	ctx := context.Background()
	query := NoteQuery{View: "notebook", NotebookID: notebookID, Limit: 300}
	b.ResetTimer()
	for index := 0; index < b.N; index++ {
		if _, err := store.ListNotes(ctx, query); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkListNotesSearch300(b *testing.B) {
	store, _ := newBenchStore(b, 5000)
	ctx := context.Background()
	query := NoteQuery{View: "all", Search: "consectetur", Limit: 300}
	b.ResetTimer()
	for index := 0; index < b.N; index++ {
		if _, err := store.ListNotes(ctx, query); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkNoteSnippet(b *testing.B) {
	body := strings.Repeat(
		"## Heading with [a link](https://example.com/page) and ![image alt](img.png) text\n"+
			"- bullet **bold** and `code` with lorem ipsum dolor sit amet consectetur.\n",
		20,
	)
	b.ResetTimer()
	for index := 0; index < b.N; index++ {
		_ = noteSnippet(body, 180)
	}
}
