package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestManagedDirectoryExclusionsHideAndRestoreExactNames(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	root := filepath.Join(t.TempDir(), "Vault")
	paths := []string{
		filepath.Join(root, "archive", "A.md"),
		filepath.Join(root, "archive", "Inside.md"),
		filepath.Join(root, "A.md"),
		filepath.Join(root, "lower", "a.md"),
		filepath.Join(root, "keep.md"),
	}
	for _, path := range paths {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(filepath.Base(path)+" body"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(paths[2], []byte("secret hidden body"), 0o644); err != nil {
		t.Fatal(err)
	}
	report, err := store.RegisterManagedDirectory(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	page, err := store.ListNotes(ctx, NoteQuery{View: "notebook", NotebookID: report.NotebookID})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 5 {
		t.Fatalf("initial notes = %#v", page.Items)
	}
	var hiddenID string
	for _, item := range page.Items {
		if item.Title == "A" && item.NotebookID == report.NotebookID {
			hiddenID = item.ID
		}
	}
	if hiddenID == "" {
		t.Fatal("root A.md was not indexed")
	}
	if err := store.SetNoteTags(ctx, hiddenID, []string{"preserved"}); err != nil {
		t.Fatal(err)
	}
	if err := store.SetNotePinned(ctx, hiddenID, true); err != nil {
		t.Fatal(err)
	}
	if err := store.SetNoteTodo(ctx, hiddenID, true, 123456789, 0); err != nil {
		t.Fatal(err)
	}
	info := defaultNoteInfoFields()
	info[0].Value = "preserved info"
	if _, err := store.SetNoteAdditionalInfo(ctx, hiddenID, info); err != nil {
		t.Fatal(err)
	}

	exclusionReport, err := store.ApplyManagedDirectoryExclusions(
		ctx,
		ManagedDirectoryExclusions{
			FolderNames:       []string{"archive"},
			MarkdownFileNames: []string{"A.md"},
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if exclusionReport.HiddenNotes != 3 || exclusionReport.HiddenNotebooks != 1 ||
		exclusionReport.RestoredNotes != 0 {
		t.Fatalf("unexpected exclusion report: %#v", exclusionReport)
	}
	page, err = store.ListNotes(ctx, NoteQuery{View: "notebook", NotebookID: report.NotebookID})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 2 {
		t.Fatalf("visible notes after exclusion = %#v", page.Items)
	}
	for _, item := range page.Items {
		if item.Title != "a" && item.Title != "keep" {
			t.Fatalf("unexpected visible note: %#v", item)
		}
	}
	if _, err := store.GetNote(ctx, hiddenID); err == nil {
		t.Fatal("hidden note remained directly accessible")
	}
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, notebook := range notebooks {
		if notebook.StoragePath == "archive" {
			t.Fatalf("excluded notebook remained visible: %#v", notebook)
		}
	}
	search, err := store.SearchNotes(ctx, "secret hidden", 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(search) != 0 {
		t.Fatalf("hidden note appeared in search: %#v", search)
	}
	bootstrap, err := store.Bootstrap(ctx, "", "")
	if err != nil {
		t.Fatal(err)
	}
	if bootstrap.NoteCount != 2 {
		t.Fatalf("bootstrap counted hidden notes: %#v", bootstrap)
	}
	dashboard, err := store.Dashboard(ctx, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if dashboard.Counts.ActiveNotes != 2 {
		t.Fatalf("dashboard counted hidden notes: %#v", dashboard.Counts)
	}
	tags, err := store.ListTags(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(tags) != 0 {
		t.Fatalf("hidden-only tag remained visible: %#v", tags)
	}
	for _, path := range paths {
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("exclusion changed external file %s: %v", path, err)
		}
	}

	restored, err := store.ApplyManagedDirectoryExclusions(ctx, ManagedDirectoryExclusions{})
	if err != nil {
		t.Fatal(err)
	}
	if restored.RestoredNotes != 3 || restored.RestoredNotebooks != 1 {
		t.Fatalf("unexpected restore report: %#v", restored)
	}
	note, err := store.GetNote(ctx, hiddenID)
	if err != nil {
		t.Fatal(err)
	}
	if !note.IsPinned || !note.IsTodo || note.TodoDue != 123456789 ||
		len(note.Tags) != 1 || note.Tags[0] != "preserved" ||
		note.AdditionalInfo[0].Value != "preserved info" {
		t.Fatalf("note metadata was not preserved: %#v", note)
	}
}

func TestManagedDirectoryExclusionsApplyToEveryManagedRoot(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	first := filepath.Join(t.TempDir(), "First")
	second := filepath.Join(t.TempDir(), "Second")
	for _, root := range []string{first, second} {
		if err := os.MkdirAll(root, 0o755); err != nil {
			t.Fatal(err)
		}
		for directory, name := range map[string]string{
			"lower": "draft.md",
			"upper": "Draft.md",
		} {
			path := filepath.Join(root, directory)
			if err := os.MkdirAll(path, 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(path, name), []byte(name), 0o644); err != nil {
				t.Fatal(err)
			}
		}
		if err := os.WriteFile(filepath.Join(root, "keep.md"), []byte("keep"), 0o644); err != nil {
			t.Fatal(err)
		}
		if _, err := store.RegisterManagedDirectory(ctx, root); err != nil {
			t.Fatal(err)
		}
	}
	report, err := store.ApplyManagedDirectoryExclusions(
		ctx,
		ManagedDirectoryExclusions{MarkdownFileNames: []string{"draft.md"}},
	)
	if err != nil {
		t.Fatal(err)
	}
	if report.RootCount != 2 || report.HiddenNotes != 2 {
		t.Fatalf("unexpected report: %#v", report)
	}
	page, err := store.ListNotes(ctx, NoteQuery{View: "all"})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 4 {
		t.Fatalf("visible notes = %d, want 4", page.Total)
	}
	for _, note := range page.Items {
		if note.Title == "draft" {
			t.Fatalf("case-sensitive exclusion leaked lowercase draft: %#v", note)
		}
	}
	uppercase := 0
	for _, note := range page.Items {
		if note.Title == "Draft" {
			uppercase++
		}
	}
	if uppercase != 2 {
		t.Fatalf("case-sensitive exclusion hid uppercase Draft.md: %#v", page.Items)
	}
}

func TestManagedDirectoryExclusionValidation(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	root := filepath.Join(t.TempDir(), "Vault")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	if _, err := store.RegisterManagedDirectory(ctx, root); err != nil {
		t.Fatal(err)
	}
	tests := []ManagedDirectoryExclusions{
		{FolderNames: []string{"nested/name"}},
		{FolderNames: []string{"Vault"}},
		{MarkdownFileNames: []string{"draft"}},
		{MarkdownFileNames: []string{"nested/draft.md"}},
		{FolderNames: []string{" "}},
	}
	for _, value := range tests {
		if _, err := store.ApplyManagedDirectoryExclusions(ctx, value); err == nil {
			t.Fatalf("expected validation error for %#v", value)
		}
	}
	normalized, err := normalizeManagedDirectoryExclusions(ManagedDirectoryExclusions{
		FolderNames:       []string{"draft", "draft", "Draft"},
		MarkdownFileNames: []string{"note.md", "note.md"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(normalized.FolderNames) != 2 || len(normalized.MarkdownFileNames) != 1 {
		t.Fatalf("unexpected normalization: %#v", normalized)
	}
}
