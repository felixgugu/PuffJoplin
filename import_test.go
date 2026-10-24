package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	testFolderID   = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	testNoteID     = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	testTagID      = "cccccccccccccccccccccccccccccccc"
	testNoteTagID  = "dddddddddddddddddddddddddddddddd"
	testResourceID = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
	testEncrypted  = "ffffffffffffffffffffffffffffffff"
)

func createJoplinFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	db, err := sql.Open("sqlite", filepath.Join(root, "database.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	statements := []string{
		`CREATE TABLE folders(id TEXT PRIMARY KEY,parent_id TEXT,title TEXT,created_time INT,updated_time INT)`,
		`CREATE TABLE notes(id TEXT PRIMARY KEY,parent_id TEXT,title TEXT,body TEXT,created_time INT,updated_time INT,
			is_conflict INT,is_todo INT,todo_due INT,todo_completed INT,source_url TEXT,author TEXT,
			deleted_time INT,encryption_applied INT,is_locked INT)`,
		`CREATE TABLE tags(id TEXT PRIMARY KEY,title TEXT,created_time INT,updated_time INT)`,
		`CREATE TABLE note_tags(id TEXT PRIMARY KEY,note_id TEXT,tag_id TEXT,created_time INT,updated_time INT)`,
		`CREATE TABLE resources(id TEXT PRIMARY KEY,title TEXT,mime TEXT,filename TEXT,file_extension TEXT,size INT,created_time INT,updated_time INT)`,
		`CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT,type INT)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("create fixture schema: %v", err)
		}
	}
	if _, err := db.Exec(`INSERT INTO folders VALUES(?, '', 'Imported', 1700000000000, 1700000001000)`, testFolderID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO notes VALUES(?, ?, 'Profile note', ?, 1700000000000, 1700000001000, 0, 0, 0, 0, '', 'Author', 0, 0, 0)`,
		testNoteID, testFolderID, "Body with resource ![image](:/"+testResourceID+")"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO notes VALUES(?, ?, 'Encrypted note', '', 1700000000000, 1700000001000, 0, 0, 0, 0, '', '', 0, 1, 0)`,
		testEncrypted, testFolderID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO tags VALUES(?, 'travel', 1700000000000, 1700000001000)`, testTagID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO note_tags VALUES(?, ?, ?, 1700000000000, 1700000001000)`,
		testNoteTagID, testNoteID, testTagID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO resources VALUES(?, 'image', 'image/png', 'image.png', 'png', 4, 1700000000000, 1700000001000)`,
		testResourceID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO settings VALUES('theme', '2', 1)`); err != nil {
		t.Fatal(err)
	}
	resourcesDir := filepath.Join(root, "resources")
	if err := os.MkdirAll(resourcesDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(resourcesDir, testResourceID+".png"), []byte("PNG!"), 0o644); err != nil {
		t.Fatal(err)
	}
	profiles := `{"version":2,"currentProfileId":"default","profiles":[{"id":"default","name":"My Joplin"}]}`
	if err := os.WriteFile(filepath.Join(root, "profiles.json"), []byte(profiles), 0o644); err != nil {
		t.Fatal(err)
	}
	return root
}

func fileHash(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func TestImportJoplinProfileIsReadOnlyAndIdempotent(t *testing.T) {
	ctx := context.Background()
	source := createJoplinFixture(t)
	sourceDB := filepath.Join(source, "database.sqlite")
	before := fileHash(t, sourceDB)

	store := newTestStore(t)
	report, err := importJoplinProfile(ctx, store, source, nil)
	if err != nil {
		t.Fatalf("import profile: %v", err)
	}
	if report.Notes != 1 || report.Notebooks != 1 || report.Tags != 1 || report.Resources != 1 {
		t.Fatalf("unexpected report: %#v", report)
	}
	if len(report.EncryptedSkipped) != 1 {
		t.Fatalf("encrypted warning missing: %#v", report.EncryptedSkipped)
	}
	page, err := store.ListNotes(ctx, NoteQuery{View: "all", Limit: 20})
	if err != nil || len(page.Items) != 1 {
		t.Fatalf("notes = %#v, err = %v", page, err)
	}
	note, err := store.GetNote(ctx, testNoteID)
	if err != nil || len(note.Tags) != 1 || len(note.Resources) != 1 {
		t.Fatalf("imported note = %#v, err = %v", note, err)
	}

	again, err := importJoplinProfile(ctx, store, source, nil)
	if err != nil {
		t.Fatalf("second import: %v", err)
	}
	if again.Notes != 0 || again.Resources != 0 {
		t.Fatalf("second import duplicated items: %#v", again)
	}
	if got := fileHash(t, sourceDB); got != before {
		t.Fatalf("source database changed: %s != %s", got, before)
	}
	if _, err := os.Stat(filepath.Join(store.resourcesDir, testResourceID)); err != nil {
		t.Fatalf("resource not copied: %v", err)
	}
	if theme, ok, err := store.GetSetting(ctx, "theme"); err != nil || !ok || theme != "dark" {
		t.Fatalf("theme setting = %q, %v, %v", theme, ok, err)
	}
}

func TestInspectJoplinProfile(t *testing.T) {
	source := createJoplinFixture(t)
	preview, err := inspectJoplinProfile(source)
	if err != nil {
		t.Fatalf("inspect profile: %v", err)
	}
	if !preview.Available || preview.DisplayName != "My Joplin" {
		t.Fatalf("unexpected preview identity: %#v", preview)
	}
	if preview.Notes != 2 || preview.Notebooks != 1 || preview.Resources != 1 || preview.EncryptedNotes != 1 {
		t.Fatalf("unexpected preview counts: %#v", preview)
	}
}

func TestImportJoplinProfileMergesTagByTitle(t *testing.T) {
	ctx := context.Background()
	source := createJoplinFixture(t)
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	existingNote, err := store.CreateNote(ctx, notebooks[0].ID, "Existing note", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SetNoteTags(ctx, existingNote.ID, []string{"Travel"}); err != nil {
		t.Fatal(err)
	}

	report, err := importJoplinProfile(ctx, store, source, nil)
	if err != nil {
		t.Fatalf("import with existing tag title: %v", err)
	}
	if report.Tags != 0 {
		t.Fatalf("existing tag should be reused, inserted %d", report.Tags)
	}
	imported, err := store.GetNote(ctx, testNoteID)
	if err != nil {
		t.Fatal(err)
	}
	if len(imported.Tags) != 1 || imported.Tags[0] != "Travel" {
		t.Fatalf("note-tag association was not remapped: %#v", imported.Tags)
	}
	tags, err := store.ListTags(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(tags) != 1 || tags[0].Count != 2 {
		t.Fatalf("tag merge produced unexpected result: %#v", tags)
	}
}

func TestJEXRoundTrip(t *testing.T) {
	ctx := context.Background()
	source := newTestStore(t)
	notebooks, _ := source.ListNotebooks(ctx)
	note, err := source.CreateNote(ctx, notebooks[0].ID, "JEX note", "See attachment")
	if err != nil {
		t.Fatal(err)
	}
	attachment := filepath.Join(t.TempDir(), "note.txt")
	if err := os.WriteFile(attachment, []byte("JEX attachment"), 0o644); err != nil {
		t.Fatal(err)
	}
	resource, err := source.AddResource(ctx, note.ID, attachment)
	if err != nil {
		t.Fatal(err)
	}
	input := noteInputFromNote(note)
	input.Body = "See attachment [note](:/" + resource.ID + ")"
	if _, err := source.UpdateNote(ctx, input); err != nil {
		t.Fatal(err)
	}
	if err := source.SetNoteTags(ctx, note.ID, []string{"archive"}); err != nil {
		t.Fatal(err)
	}
	archive := filepath.Join(t.TempDir(), "roundtrip.jex")
	if err := exportJEX(ctx, source, notebooks[0].ID, archive); err != nil {
		t.Fatalf("export JEX: %v", err)
	}

	target := newTestStore(t)
	targetNotebook, err := target.CreateNotebook(ctx, "JEX destination", "")
	if err != nil {
		t.Fatal(err)
	}
	report, err := importJEX(ctx, target, archive, targetNotebook.ID, nil)
	if err != nil {
		t.Fatalf("import JEX: %v", err)
	}
	if report.Notes != 1 || report.Resources != 1 || report.Tags != 1 {
		t.Fatalf("unexpected JEX report: %#v", report)
	}
	page, err := target.ListNotes(ctx, NoteQuery{View: "all", Limit: 20})
	if err != nil || len(page.Items) != 1 {
		t.Fatalf("target notes = %#v, err = %v", page, err)
	}
	imported, err := target.GetNote(ctx, page.Items[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(imported.Tags) != 1 || len(imported.Resources) != 1 {
		t.Fatalf("imported JEX note is incomplete: %#v", imported)
	}
	if !strings.Contains(imported.Body, imported.Resources[0].ID) {
		t.Fatalf("body link was not remapped: %s", imported.Body)
	}
	importedNotebooks, err := target.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	foundNestedNotebook := false
	for _, notebook := range importedNotebooks {
		if notebook.ParentID == targetNotebook.ID {
			foundNestedNotebook = true
			break
		}
	}
	if !foundNestedNotebook {
		t.Fatalf("JEX root notebook was not nested under destination: %#v", importedNotebooks)
	}

	markdownTarget := filepath.Join(t.TempDir(), "markdown-export.md")
	if err := exportMarkdown(ctx, source, notebooks[0].ID, markdownTarget); err != nil {
		t.Fatalf("export Markdown: %v", err)
	}
	markdownDir := strings.TrimSuffix(markdownTarget, filepath.Ext(markdownTarget))
	if _, err := os.Stat(filepath.Join(markdownDir, "_resources", "note.txt")); err != nil {
		t.Fatalf("Markdown resource was not exported: %v", err)
	}
	entries, err := os.ReadDir(markdownDir)
	if err != nil {
		t.Fatal(err)
	}
	var noteContent []byte
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".md") {
			noteContent, err = os.ReadFile(filepath.Join(markdownDir, entry.Name()))
			if err != nil {
				t.Fatal(err)
			}
			break
		}
	}
	if !strings.Contains(string(noteContent), "_resources/note.txt") {
		t.Fatalf("Markdown body did not reference exported resource: %s", noteContent)
	}
}

func TestImportENEX(t *testing.T) {
	ctx := context.Background()
	enex := `<?xml version="1.0" encoding="UTF-8"?>
<en-export>
  <note>
    <title>Evernote note</title>
    <content><![CDATA[<en-note><h1>Heading</h1><p>Hello <strong>world</strong></p></en-note>]]></content>
    <created>20250101T120000Z</created>
    <updated>20250102T120000Z</updated>
    <tag>imported</tag>
  </note>
</en-export>`
	path := filepath.Join(t.TempDir(), "export.enex")
	if err := os.WriteFile(path, []byte(enex), 0o644); err != nil {
		t.Fatal(err)
	}
	store := newTestStore(t)
	destination, err := store.CreateNotebook(ctx, "Evernote destination", "")
	if err != nil {
		t.Fatal(err)
	}
	report, err := importENEX(ctx, store, path, destination.ID, nil)
	if err != nil {
		t.Fatalf("import ENEX: %v", err)
	}
	if report.Notes != 1 || report.Tags != 1 {
		t.Fatalf("unexpected report: %#v", report)
	}
	page, _ := store.ListNotes(ctx, NoteQuery{View: "all", Limit: 20})
	note, err := store.GetNote(ctx, page.Items[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(note.Body, "# Heading") || !strings.Contains(note.Body, "**world**") {
		t.Fatalf("HTML was not converted: %s", note.Body)
	}
	if note.NotebookID != destination.ID {
		t.Fatalf("note imported into %s, want %s", note.NotebookID, destination.ID)
	}
}

func TestImportMarkdownIntoNotebook(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	destination, err := store.CreateNotebook(ctx, "Markdown destination", "")
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "import.md")
	if err := os.WriteFile(path, []byte("# Imported\n\nBody"), 0o644); err != nil {
		t.Fatal(err)
	}
	report, err := importMarkdownFile(ctx, store, path, destination.ID)
	if err != nil {
		t.Fatal(err)
	}
	if report.Notes != 1 || report.Notebooks != 0 {
		t.Fatalf("unexpected report: %#v", report)
	}
	page, err := store.ListNotes(ctx, NoteQuery{View: "notebook", NotebookID: destination.ID, Limit: 20})
	if err != nil || len(page.Items) != 1 {
		t.Fatalf("destination notes = %#v, err = %v", page, err)
	}
}
