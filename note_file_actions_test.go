package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestManagedMarkdownNotePath(t *testing.T) {
	path := filepath.Join(t.TempDir(), "note.md")
	if err := os.WriteFile(path, []byte("# note"), 0o644); err != nil {
		t.Fatal(err)
	}
	actual, err := managedMarkdownNotePath(Note{
		StorageKind:  storageKindDirectory,
		ExternalPath: path,
	})
	if err != nil {
		t.Fatal(err)
	}
	if actual != filepath.Clean(path) {
		t.Fatalf("unexpected path: %s", actual)
	}
}

func TestManagedMarkdownNotePathRejectsNonMarkdownFiles(t *testing.T) {
	path := filepath.Join(t.TempDir(), "note.txt")
	if err := os.WriteFile(path, []byte("note"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := managedMarkdownNotePath(Note{
		StorageKind:  storageKindDirectory,
		ExternalPath: path,
	}); err == nil {
		t.Fatal("non-Markdown file was accepted")
	}
	if _, err := managedMarkdownNotePath(Note{}); err == nil {
		t.Fatal("non-managed note was accepted")
	}
}
