package main

import (
	"context"
	"strings"
	"testing"
)

func TestNoteAdditionalInfoDefaultsAndNormalization(t *testing.T) {
	defaults := defaultNoteInfoFields()
	if len(defaults) != 12 {
		t.Fatalf("default field count = %d", len(defaults))
	}
	if defaults[0].Key != noteInfoCompanyName || defaults[4].Key != noteInfoDocumentTitle {
		t.Fatalf("unexpected default fields: %#v", defaults)
	}

	fields := normalizeNoteInfoFields([]NoteInfoField{
		{Key: noteInfoCompanyName, Label: "  機構  ", Value: "  文件\n  " + strings.Repeat("甲", 240)},
		{Key: "unknown", Label: "忽略", Value: "忽略"},
		{Key: noteInfoDocumentTitle, Label: "", Value: ""},
	})
	if len(fields) != 12 {
		t.Fatalf("normalized field count = %d", len(fields))
	}
	if fields[0].Label != "機構" || fields[0].Value != "文件 "+strings.Repeat("甲", noteInfoValueMaxLength-3) {
		t.Fatalf("company normalization = %#v", fields[0])
	}
	if fields[4].Label != "文件標題" {
		t.Fatalf("empty label fallback = %q", fields[4].Label)
	}
}

func TestStorePersistsNoteAdditionalInfoAndLoadsWithNote(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	note, err := store.CreateNote(ctx, notebooks[0].ID, "封面測試", "")
	if err != nil {
		t.Fatal(err)
	}
	fields := defaultNoteInfoFields()
	fields[0].Value = "Puff 公司"
	fields[4].Label = "報告名稱"
	fields[4].Value = "年度成果報告"
	saved, err := store.SetNoteAdditionalInfo(ctx, note.ID, fields)
	if err != nil {
		t.Fatal(err)
	}
	if saved[0].Value != "Puff 公司" || saved[4].Label != "報告名稱" {
		t.Fatalf("saved fields = %#v", saved)
	}

	loaded, err := store.GetNote(ctx, note.ID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.AdditionalInfo[0].Value != "Puff 公司" ||
		loaded.AdditionalInfo[4].Value != "年度成果報告" {
		t.Fatalf("loaded fields = %#v", loaded.AdditionalInfo)
	}

	if _, err := store.db.Exec(`DELETE FROM notes WHERE id = ?`, note.ID); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := store.db.QueryRow(
		`SELECT COUNT(*) FROM note_additional_info WHERE note_id = ?`,
		note.ID,
	).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("additional info was not cascaded, count = %d", count)
	}
}
