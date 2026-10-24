package main

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSaveDocxExportWritesValidatedPackage(t *testing.T) {
	app := &App{}
	if err := app.SaveDocxExport("relative.docx", "UEsDBA=="); err == nil {
		t.Fatal("relative DOCX path was accepted")
	}
	path := filepath.Join(t.TempDir(), "export.docx")
	data := []byte("PK\x03\x04docx-package")
	if err := app.SaveDocxExport(path, base64.StdEncoding.EncodeToString(data)); err != nil {
		t.Fatal(err)
	}
	written, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(string(written), "PK\x03\x04") {
		t.Fatalf("unexpected DOCX bytes: %q", written)
	}
}

func TestExportMarkdownPreservesTreeAndSplitsResources(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	root, err := store.CreateNotebook(ctx, "Export root", "")
	if err != nil {
		t.Fatal(err)
	}
	child, err := store.CreateNotebook(ctx, "Child notebook", root.ID)
	if err != nil {
		t.Fatal(err)
	}
	note, err := store.CreateNote(ctx, root.ID, "Root note", "")
	if err != nil {
		t.Fatal(err)
	}
	image, err := store.AddResourceData(ctx, note.ID, "cover photo.png", []byte("\x89PNG\r\n\x1a\nimage"))
	if err != nil {
		t.Fatal(err)
	}
	attachment, err := store.AddResourceData(ctx, note.ID, "manual.pdf", []byte("%PDF-test"))
	if err != nil {
		t.Fatal(err)
	}
	input := noteInputFromNote(note)
	input.Body = "![cover](:/" + image.ID + ")\n\n[manual](/resources/" + attachment.ID + ")"
	if _, err := store.UpdateNote(ctx, input); err != nil {
		t.Fatal(err)
	}
	if _, err := store.CreateNote(ctx, child.ID, "Child note", "nested"); err != nil {
		t.Fatal(err)
	}

	destination := filepath.Join(t.TempDir(), "markdown export")
	if err := exportMarkdown(ctx, store, root.ID, destination); err != nil {
		t.Fatal(err)
	}
	rootMarkdown, err := os.ReadFile(filepath.Join(destination, "Root note.md"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(rootMarkdown), "images/cover%20photo.png") ||
		!strings.Contains(string(rootMarkdown), "resources/manual.pdf") {
		t.Fatalf("unexpected root markdown links: %s", rootMarkdown)
	}
	if _, err := os.Stat(filepath.Join(destination, "images", "cover photo.png")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(destination, "resources", "manual.pdf")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(destination, "Child notebook", "Child note.md")); err != nil {
		t.Fatal(err)
	}
}

func TestBuildNotebookDocxMarkdownEmbedsResources(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	root, err := store.CreateNotebook(ctx, "DOCX root", "")
	if err != nil {
		t.Fatal(err)
	}
	note, err := store.CreateNote(ctx, root.ID, "DOCX note", "")
	if err != nil {
		t.Fatal(err)
	}
	image, err := store.AddResourceData(ctx, note.ID, "photo.png", []byte("\x89PNG\r\n\x1a\nimage"))
	if err != nil {
		t.Fatal(err)
	}
	attachment, err := store.AddResourceData(ctx, note.ID, "notes.txt", []byte("attachment"))
	if err != nil {
		t.Fatal(err)
	}
	input := noteInputFromNote(note)
	input.Body = "![photo](:/" + image.ID + ")\n\n[notes](:/" + attachment.ID + ")"
	if _, err := store.UpdateNote(ctx, input); err != nil {
		t.Fatal(err)
	}

	markdown, err := buildNotebookDocxMarkdown(ctx, store, root.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(markdown, "# DOCX root") ||
		!strings.Contains(markdown, "## DOCX note") {
		t.Fatalf("document headings missing: %s", markdown)
	}
	if !strings.Contains(markdown, "data:image/png;base64,") ||
		!strings.Contains(markdown, "data:text/plain;base64,") {
		t.Fatalf("resources were not embedded: %s", markdown)
	}
	if strings.Contains(markdown, ":/") {
		t.Fatalf("internal resource URL leaked into DOCX markdown: %s", markdown)
	}
}
