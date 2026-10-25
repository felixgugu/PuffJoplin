package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	root := t.TempDir()
	store, err := OpenStore(filepath.Join(root, "puffjoplin.sqlite"), filepath.Join(root, "resources"))
	if err != nil {
		t.Fatalf("OpenStore: %v", err)
	}
	t.Cleanup(func() {
		if err := store.Close(); err != nil {
			t.Errorf("close store: %v", err)
		}
	})
	return store
}

func TestStoreAppliesConnectionPragmasToEveryPooledConnection(t *testing.T) {
	store := newTestStore(t)
	connections := make([]*sql.Conn, 0, 4)
	for index := 0; index < 4; index++ {
		conn, err := store.db.Conn(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		connections = append(connections, conn)
	}
	defer func() {
		for _, conn := range connections {
			_ = conn.Close()
		}
	}()

	for index, conn := range connections {
		var busyTimeout, foreignKeys, synchronous int
		if err := conn.QueryRowContext(context.Background(), `PRAGMA busy_timeout`).Scan(&busyTimeout); err != nil {
			t.Fatal(err)
		}
		if err := conn.QueryRowContext(context.Background(), `PRAGMA foreign_keys`).Scan(&foreignKeys); err != nil {
			t.Fatal(err)
		}
		if err := conn.QueryRowContext(context.Background(), `PRAGMA synchronous`).Scan(&synchronous); err != nil {
			t.Fatal(err)
		}
		if busyTimeout != 5000 || foreignKeys != 1 || synchronous != 1 {
			t.Fatalf("connection %d pragmas: busy=%d foreign=%d synchronous=%d", index, busyTimeout, foreignKeys, synchronous)
		}
	}
}

func TestOpenStorePathWithSpacesAndHash(t *testing.T) {
	root := filepath.Join(t.TempDir(), "PuffJoplin data #1")
	store, err := OpenStore(filepath.Join(root, "puffjoplin.sqlite"), filepath.Join(root, "resources"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	state, err := store.Bootstrap(context.Background(), root, "")
	if err != nil || state.NotebookCount == 0 {
		t.Fatalf("bootstrap = %#v, err = %v", state, err)
	}
}

func TestStoreConcurrentSettingsWritesWaitForBusyDatabase(t *testing.T) {
	store := newTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	errorsCh := make(chan error, 12)
	for index := 0; index < 12; index++ {
		index := index
		go func() {
			errorsCh <- store.SetSetting(ctx, fmt.Sprintf("concurrent.%d", index), "value")
		}()
	}
	for index := 0; index < 12; index++ {
		if err := <-errorsCh; err != nil {
			t.Fatalf("concurrent setting write %d: %v", index, err)
		}
	}
}

func TestStoreNoteLifecycleSearchAndTags(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil || len(notebooks) == 0 {
		t.Fatalf("default notebook: %v, %d", err, len(notebooks))
	}

	note, err := store.CreateNote(ctx, notebooks[0].ID, "Shopping", "Milk and coffee beans")
	if err != nil {
		t.Fatalf("CreateNote: %v", err)
	}
	if err := store.SetNoteTags(ctx, note.ID, []string{"home", " errands ", "HOME"}); err != nil {
		t.Fatalf("SetNoteTags: %v", err)
	}
	tags, err := store.ListTags(ctx)
	if err != nil || len(tags) != 2 {
		t.Fatalf("tags = %#v, err = %v", tags, err)
	}
	results, err := store.SearchNotes(ctx, "coffee", 20)
	if err != nil || len(results) != 1 || results[0].ID != note.ID {
		t.Fatalf("search = %#v, err = %v", results, err)
	}

	input := noteInputFromNote(note)
	input.Body = "Milk, coffee beans, and tea"
	updated, err := store.UpdateNote(ctx, input)
	if err != nil || !strings.Contains(updated.Body, "tea") {
		t.Fatalf("UpdateNote = %#v, err = %v", updated, err)
	}
	if err := store.TrashNote(ctx, note.ID); err != nil {
		t.Fatalf("TrashNote: %v", err)
	}
	trash, err := store.ListNotes(ctx, NoteQuery{View: "trash", Limit: 20})
	if err != nil || len(trash.Items) != 1 {
		t.Fatalf("trash = %#v, err = %v", trash, err)
	}
	if err := store.RestoreNote(ctx, note.ID); err != nil {
		t.Fatalf("RestoreNote: %v", err)
	}
	if err := store.DeleteNotePermanently(ctx, note.ID); err != nil {
		t.Fatalf("DeleteNotePermanently: %v", err)
	}
	if _, err := store.GetNote(ctx, note.ID); err == nil {
		t.Fatal("deleted note is still accessible")
	}
}

func TestListNotesSearchRules(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	create := func(title, body string) {
		t.Helper()
		if _, err := store.CreateNote(ctx, notebooks[0].ID, title, body); err != nil {
			t.Fatal(err)
		}
	}
	create("Alpha report", "Coffee in the body")
	create("A cat sat", "CAT in the body")
	create("concatenate", "scatter")
	create("這是中文筆記本", "連續中文內容")
	create("中文，筆記", "標點分隔")
	create("100% done", "under_score")

	titles := func(query NoteQuery) string {
		t.Helper()
		query.View = "all"
		query.SortBy = "title"
		query.SortDirection = "asc"
		query.Limit = 20
		page, err := store.ListNotes(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		items := make([]string, 0, len(page.Items))
		for _, item := range page.Items {
			items = append(items, item.Title)
		}
		return strings.Join(items, ",")
	}

	if got := titles(NoteQuery{Search: "alpha", SearchField: "title"}); got != "Alpha report" {
		t.Fatalf("case-insensitive title search = %q", got)
	}
	if got := titles(NoteQuery{
		Search: "alpha", SearchField: "title", SearchCaseSensitive: true,
	}); got != "" {
		t.Fatalf("case-sensitive title search = %q", got)
	}
	if got := titles(NoteQuery{Search: "Coffee"}); got != "Alpha report" {
		t.Fatalf("title and body search = %q", got)
	}
	if got := titles(NoteQuery{Search: "Coffee", SearchField: "title"}); got != "" {
		t.Fatalf("title-only search = %q", got)
	}
	if got := titles(NoteQuery{Search: "cat"}); !strings.Contains(got, "concatenate") {
		t.Fatalf("substring search = %q", got)
	}
	if got := titles(NoteQuery{Search: "cat", SearchWholeWord: true}); got != "A cat sat" {
		t.Fatalf("whole-word search = %q", got)
	}
	if got := titles(NoteQuery{
		Search: "Cat", SearchWholeWord: true, SearchCaseSensitive: true,
	}); got != "" {
		t.Fatalf("case-sensitive whole-word search = %q", got)
	}
	if got := titles(NoteQuery{Search: "中文筆記", SearchWholeWord: true}); got != "" {
		t.Fatalf("continuous CJK whole-word search = %q", got)
	}
	if got := titles(NoteQuery{Search: "中文", SearchWholeWord: true}); got != "中文，筆記" {
		t.Fatalf("punctuation-delimited CJK whole-word search = %q", got)
	}
	if got := titles(NoteQuery{Search: "100%", SearchField: "title"}); got != "100% done" {
		t.Fatalf("literal percent search = %q", got)
	}
	if got := titles(NoteQuery{Search: "under_score"}); got != "100% done" {
		t.Fatalf("literal underscore search = %q", got)
	}
}

func TestTrashNoteRejectsMissingNote(t *testing.T) {
	store := newTestStore(t)
	if err := store.TrashNote(context.Background(), "missing"); err == nil {
		t.Fatal("expected missing note error")
	}
}

func TestListNotesSortsAcrossAllSupportedFields(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	notes := map[string]Note{}
	for _, title := range []string{"Beta", "Alpha", "Gamma"} {
		note, err := store.CreateNote(ctx, notebooks[0].ID, title, "")
		if err != nil {
			t.Fatal(err)
		}
		notes[title] = note
	}
	for title, times := range map[string][2]int64{
		"Alpha": {300, 100},
		"Beta":  {100, 300},
		"Gamma": {200, 200},
	} {
		if _, err := store.db.ExecContext(ctx,
			`UPDATE notes SET created_at = ?, updated_at = ? WHERE id = ?`,
			times[0], times[1], notes[title].ID,
		); err != nil {
			t.Fatal(err)
		}
	}

	listTitles := func(query NoteQuery) []string {
		t.Helper()
		page, err := store.ListNotes(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		titles := make([]string, 0, len(page.Items))
		for _, note := range page.Items {
			titles = append(titles, note.Title)
		}
		return titles
	}

	if got := listTitles(NoteQuery{View: "all", SortBy: "title", SortDirection: "asc"}); strings.Join(got, ",") != "Alpha,Beta,Gamma" {
		t.Fatalf("title ascending = %v", got)
	}
	if got := listTitles(NoteQuery{View: "all", SortBy: "title", SortDirection: "desc"}); strings.Join(got, ",") != "Gamma,Beta,Alpha" {
		t.Fatalf("title descending = %v", got)
	}
	if got := listTitles(NoteQuery{View: "all", SortBy: "created", SortDirection: "asc"}); strings.Join(got, ",") != "Beta,Gamma,Alpha" {
		t.Fatalf("created ascending = %v", got)
	}
	if got := listTitles(NoteQuery{View: "all", SortBy: "created", SortDirection: "desc"}); strings.Join(got, ",") != "Alpha,Gamma,Beta" {
		t.Fatalf("created descending = %v", got)
	}
	if got := listTitles(NoteQuery{View: "all", SortBy: "updated", SortDirection: "asc"}); strings.Join(got, ",") != "Alpha,Gamma,Beta" {
		t.Fatalf("updated ascending = %v", got)
	}
	if got := listTitles(NoteQuery{View: "all", SortBy: "unknown", SortDirection: "sideways"}); strings.Join(got, ",") != "Beta,Gamma,Alpha" {
		t.Fatalf("fallback descending = %v", got)
	}
}

func TestPinnedNotesSortBeforeEverySortMode(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	alpha, err := store.CreateNote(ctx, notebooks[0].ID, "Alpha", "")
	if err != nil {
		t.Fatal(err)
	}
	zulu, err := store.CreateNote(ctx, notebooks[0].ID, "Zulu", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.db.ExecContext(ctx,
		`UPDATE notes SET created_at = 1, updated_at = 1 WHERE id = ?`, zulu.ID,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := store.db.ExecContext(ctx,
		`UPDATE notes SET created_at = 2, updated_at = 2 WHERE id = ?`, alpha.ID,
	); err != nil {
		t.Fatal(err)
	}
	if err := store.SetNotePinned(ctx, zulu.ID, true); err != nil {
		t.Fatal(err)
	}
	for _, query := range []NoteQuery{
		{View: "all", SortBy: "title", SortDirection: "asc"},
		{View: "all", SortBy: "created", SortDirection: "desc"},
		{View: "all", SortBy: "updated", SortDirection: "desc"},
	} {
		page, err := store.ListNotes(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		if len(page.Items) != 2 || !page.Items[0].IsPinned || page.Items[0].ID != zulu.ID {
			t.Fatalf("pinned order for %#v: %#v", query, page.Items)
		}
	}
	if err := store.SetNotePinned(ctx, "missing", true); err == nil {
		t.Fatal("expected missing pin target error")
	}
}

func TestTodoViewsFiltersCompletesAndSortsByDueDate(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	create := func(title string) Note {
		t.Helper()
		note, err := store.CreateNote(ctx, notebooks[0].ID, title, "")
		if err != nil {
			t.Fatal(err)
		}
		return note
	}
	overdue := create("Overdue")
	future := create("Future")
	undated := create("Undated")
	completed := create("Completed")
	normal := create("Normal")
	for _, item := range []struct {
		note      Note
		due       int64
		completed int64
	}{
		{overdue, 100, 0},
		{future, 300, 0},
		{undated, 0, 0},
		{completed, 50, 200},
	} {
		if err := store.SetNoteTodo(ctx, item.note.ID, true, item.due, item.completed); err != nil {
			t.Fatal(err)
		}
	}

	titles := func(status string) string {
		t.Helper()
		page, err := store.ListNotes(ctx, NoteQuery{
			View: "todo", TodoStatus: status, SortBy: "due", SortDirection: "asc", Limit: 20,
		})
		if err != nil {
			t.Fatal(err)
		}
		items := make([]string, 0, len(page.Items))
		for _, item := range page.Items {
			items = append(items, item.Title)
		}
		return strings.Join(items, ",")
	}
	if got := titles("open"); got != "Overdue,Future,Undated" {
		t.Fatalf("open todos = %q", got)
	}
	if got := titles("completed"); got != "Completed" {
		t.Fatalf("completed todos = %q", got)
	}
	if got := titles("all"); got != "Overdue,Future,Undated,Completed" {
		t.Fatalf("all todos = %q", got)
	}

	if err := store.SetNoteTodo(ctx, overdue.ID, false, 0, 0); err != nil {
		t.Fatal(err)
	}
	if got := titles("open"); got != "Future,Undated" {
		t.Fatalf("open todos after cancel = %q", got)
	}
	if err := store.SetNoteTodo(ctx, normal.ID, true, 0, 0); err != nil {
		t.Fatal(err)
	}
	if got := titles("open"); got != "Future,Normal,Undated" {
		t.Fatalf("open todos after conversion = %q", got)
	}
}

func TestListNotesIncludesNotebookDescendants(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	parent, err := store.CreateNotebook(ctx, "Parent", "")
	if err != nil {
		t.Fatal(err)
	}
	child, err := store.CreateNotebook(ctx, "Child", parent.ID)
	if err != nil {
		t.Fatal(err)
	}
	grandchild, err := store.CreateNotebook(ctx, "Grandchild", child.ID)
	if err != nil {
		t.Fatal(err)
	}
	sibling, err := store.CreateNotebook(ctx, "Sibling", "")
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range []struct {
		notebook string
		title    string
	}{
		{parent.ID, "Parent note"},
		{child.ID, "Child note"},
		{grandchild.ID, "Grandchild note"},
		{sibling.ID, "Sibling note"},
	} {
		if _, err := store.CreateNote(ctx, item.notebook, item.title, ""); err != nil {
			t.Fatal(err)
		}
	}
	childNote, err := store.CreateNote(ctx, child.ID, "Trashed child", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := store.TrashNote(ctx, childNote.ID); err != nil {
		t.Fatal(err)
	}

	page, err := store.ListNotes(ctx, NoteQuery{View: "notebook", NotebookID: parent.ID, SortBy: "title"})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 3 {
		t.Fatalf("descendant notes = %d, want 3", len(page.Items))
	}
	for _, item := range page.Items {
		if item.Title == "Sibling note" || item.Title == "Trashed child" {
			t.Fatalf("unexpected note in subtree: %#v", item)
		}
	}
	trash, err := store.ListNotes(ctx, NoteQuery{View: "trash", NotebookID: parent.ID})
	if err != nil {
		t.Fatal(err)
	}
	if len(trash.Items) != 1 || trash.Items[0].ID != childNote.ID {
		t.Fatalf("trashed descendant = %#v", trash.Items)
	}
}

func TestOpenStoreMigratesPinnedColumn(t *testing.T) {
	root := t.TempDir()
	dbPath := filepath.Join(root, "legacy.sqlite")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`
		CREATE TABLE schema_meta (version INTEGER NOT NULL, updated_at INTEGER NOT NULL);
		INSERT INTO schema_meta(version, updated_at) VALUES(1, 1);
		CREATE TABLE notes (
			id TEXT PRIMARY KEY,
			notebook_id TEXT NOT NULL,
			title TEXT NOT NULL DEFAULT '',
			body TEXT NOT NULL DEFAULT '',
			is_todo INTEGER NOT NULL DEFAULT 0,
			todo_due INTEGER NOT NULL DEFAULT 0,
			todo_completed INTEGER NOT NULL DEFAULT 0,
			source_url TEXT NOT NULL DEFAULT '',
			author TEXT NOT NULL DEFAULT '',
			is_conflict INTEGER NOT NULL DEFAULT 0,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			deleted_at INTEGER NOT NULL DEFAULT 0
		);
	`)
	if err != nil {
		db.Close()
		t.Fatal(err)
	}
	_ = db.Close()

	store, err := OpenStore(dbPath, filepath.Join(root, "resources"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	var version int
	if err := store.db.QueryRow(`SELECT version FROM schema_meta LIMIT 1`).Scan(&version); err != nil {
		t.Fatal(err)
	}
	if version != schemaVersion {
		t.Fatalf("schema version = %d", version)
	}
	var pinned int
	if err := store.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('notes') WHERE name='is_pinned'`).Scan(&pinned); err != nil {
		t.Fatal(err)
	}
	if pinned != 1 {
		t.Fatal("is_pinned column was not added")
	}
	for _, column := range []struct {
		table string
		name  string
	}{
		{"notebooks", "storage_kind"},
		{"notebooks", "storage_root"},
		{"notebooks", "storage_path"},
		{"notes", "storage_kind"},
		{"notes", "external_path"},
		{"notes", "external_mtime"},
		{"notes", "external_size"},
		{"resources", "storage_kind"},
		{"resources", "external_path"},
	} {
		var found int
		if err := store.db.QueryRow(
			`SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?`,
			column.table,
			column.name,
		).Scan(&found); err != nil {
			t.Fatal(err)
		}
		if found != 1 {
			t.Errorf("%s.%s column was not added", column.table, column.name)
		}
	}
}

func TestStoreAttachResource(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, _ := store.ListNotebooks(ctx)
	note, err := store.CreateNote(ctx, notebooks[0].ID, "Image note", "")
	if err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(t.TempDir(), "hello.txt")
	if err := os.WriteFile(source, []byte("attachment"), 0o644); err != nil {
		t.Fatal(err)
	}
	resource, err := store.AddResource(ctx, note.ID, source)
	if err != nil {
		t.Fatalf("AddResource: %v", err)
	}
	if resource.URL != "/resources/"+resource.ID {
		t.Fatalf("unexpected URL: %s", resource.URL)
	}
	if content, err := os.ReadFile(store.resourcePath(resource.ID)); err != nil || string(content) != "attachment" {
		t.Fatalf("resource content = %q, err = %v", content, err)
	}
	if _, err := store.Resource(ctx, "../outside"); err == nil {
		t.Fatal("unsafe resource ID was accepted")
	}
}

func TestStoreRepairsMissingResourceFilenames(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, _ := store.ListNotebooks(ctx)
	note, err := store.CreateNote(ctx, notebooks[0].ID, "Attachment names", "")
	if err != nil {
		t.Fatal(err)
	}
	id := newID()
	if _, err := store.db.ExecContext(ctx,
		`INSERT INTO resources(id, note_id, title, mime, filename, file_size, created_at, updated_at)
		 VALUES(?, ?, ?, ?, '', 4, ?, ?)`,
		id, note.ID, "photo.png", "image/png", nowMillis(), nowMillis(),
	); err != nil {
		t.Fatal(err)
	}
	if err := store.normalizeStoredResourceFilenames(ctx); err != nil {
		t.Fatal(err)
	}
	resource, err := store.Resource(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if resource.Filename != "photo.png" {
		t.Fatalf("filename = %q", resource.Filename)
	}

	if got := normalizeResourceFilename("", "report", "application/pdf", ""); got != "report.pdf" {
		t.Fatalf("MIME fallback filename = %q", got)
	}
	if got := normalizeResourceFilename("", "photo", "image/png", "png"); got != "photo.png" {
		t.Fatalf("extension fallback filename = %q", got)
	}
}

func TestAddResourceDataRollsBackFileWhenDatabaseInsertFails(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, _ := store.ListNotebooks(ctx)
	note, err := store.CreateNote(ctx, notebooks[0].ID, "Rollback note", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.db.ExecContext(ctx, `
		CREATE TRIGGER reject_resource BEFORE INSERT ON resources
		BEGIN
			SELECT RAISE(FAIL, 'forced resource failure');
		END`); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadDir(store.resourcesDir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.AddResourceData(ctx, note.ID, "clipboard.png", []byte("image")); err == nil {
		t.Fatal("expected database insert to fail")
	}
	after, err := os.ReadDir(store.resourcesDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(after) != len(before) {
		t.Fatalf("orphaned resource after failed insert: before=%d after=%d", len(before), len(after))
	}
}

func TestAddResourceDataRejectsEmptyFile(t *testing.T) {
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(context.Background())
	if err != nil || len(notebooks) == 0 {
		t.Fatalf("list notebooks: %v", err)
	}
	note, err := store.CreateNote(context.Background(), notebooks[0].ID, "Empty attachment", "")
	if err != nil {
		t.Fatal(err)
	}

	if _, err := store.AddResourceData(context.Background(), note.ID, "empty.png", nil); err == nil {
		t.Fatal("expected empty resources to be rejected")
	}
}

func TestDeleteNotebookTreeRemovesNotesAndResources(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	parent, err := store.CreateNotebook(ctx, "Parent", "")
	if err != nil {
		t.Fatal(err)
	}
	child, err := store.CreateNotebook(ctx, "Child", parent.ID)
	if err != nil {
		t.Fatal(err)
	}
	note, err := store.CreateNote(ctx, child.ID, "Nested note", "Nested body")
	if err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(t.TempDir(), "nested.txt")
	if err := os.WriteFile(source, []byte("nested"), 0o644); err != nil {
		t.Fatal(err)
	}
	resource, err := store.AddResource(ctx, note.ID, source)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteNotebook(ctx, parent.ID, true); err != nil {
		t.Fatalf("DeleteNotebook tree: %v", err)
	}
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, notebook := range notebooks {
		if notebook.ID == parent.ID || notebook.ID == child.ID {
			t.Fatalf("notebook was not deleted: %#v", notebook)
		}
	}
	if _, err := store.GetNote(ctx, note.ID); err == nil {
		t.Fatal("nested note was not deleted")
	}
	if _, err := os.Stat(store.resourcePath(resource.ID)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("resource file still exists: %v", err)
	}
}

func TestSafeToOpenResource(t *testing.T) {
	for _, name := range []string{"document.pdf", "photo.PNG", "notes.md", "report.docx"} {
		if !safeToOpenResource(name) {
			t.Fatalf("expected safe attachment: %s", name)
		}
	}
	for _, name := range []string{"program.exe", "script.ps1", "shortcut.lnk", "batch.cmd"} {
		if safeToOpenResource(name) {
			t.Fatalf("expected unsafe attachment: %s", name)
		}
	}
}
