package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestPDFCoverDefaultsAndNormalization(t *testing.T) {
	design := defaultPDFCoverDesign()
	if design.Enabled || design.IncludeWatermark ||
		design.Version != pdfCoverDesignVersion ||
		len(design.Elements) != 13 {
		t.Fatalf("default cover = %#v", design)
	}
	design.Enabled = true
	design.IncludeWatermark = true
	design.Elements[0].XMm = -5
	design.Elements[1].FontSize = 200
	design.Elements[2].Alignment = "invalid"
	normalized := normalizePDFCoverDesign(design)
	if !normalized.IncludeWatermark ||
		normalized.Elements[0].XMm != 0 ||
		normalized.Elements[1].FontSize != maxPDFCoverFontSizePT ||
		normalized.Elements[2].Alignment != "left" {
		t.Fatalf("normalized cover = %#v", normalized)
	}
}

func TestBuildPDFCoverHTMLAppliesFallbackLabelsAndHiding(t *testing.T) {
	fields := defaultNoteInfoFields()
	fields[0].Value = "Puff <公司>"
	fields[1].Value = ""
	fields[4].Value = ""
	fields[7].Label = "制作部門"
	fields[7].Value = "研發部"
	fields[11].Value = "機密文件"
	note := Note{
		Title:          "Audit 2026",
		AdditionalInfo: fields,
	}
	design := defaultPDFCoverDesign()
	design.Enabled = true
	design.Elements[0].ShowLabel = true
	design.Elements[7].ShowLabel = true

	cover, err := buildPDFCoverHTML(note, design, "Copyright Puff")
	if err != nil {
		t.Fatal(err)
	}
	html := string(cover)
	if !strings.Contains(html, "公司名稱：Puff &lt;公司&gt;") {
		t.Fatalf("company label missing: %s", html)
	}
	if strings.Contains(html, "文件編號") || strings.Contains(html, "未填") {
		t.Fatalf("empty field rendered: %s", html)
	}
	if !strings.Contains(html, `class="pdf-cover-field pdf-cover-title`) ||
		!strings.Contains(html, ">Audit 2026</div>") {
		t.Fatalf("document title fallback missing: %s", html)
	}
	if !strings.Contains(html, "制作部門：研發部") ||
		!strings.Contains(html, ">機密文件</div>") ||
		!strings.Contains(html, ">Copyright Puff</div>") {
		t.Fatalf("custom label or footer text missing: %s", html)
	}
}

func TestPDFCoverDesignJSONDecodesLegacyOrInvalidValues(t *testing.T) {
	if len(decodePDFCoverDesign("").Elements) != 13 {
		t.Fatal("empty cover setting did not use defaults")
	}
	if len(decodePDFCoverDesign("{invalid").Elements) != 13 {
		t.Fatal("invalid cover setting did not use defaults")
	}
	value, _ := json.Marshal(PDFCoverDesign{Enabled: true})
	design := decodePDFCoverDesign(string(value))
	if !design.Enabled || len(design.Elements) != 13 {
		t.Fatalf("partial cover setting = %#v", design)
	}
	if design.IncludeWatermark {
		t.Fatal("legacy cover setting should not include a cover watermark")
	}
	if design.Version != pdfCoverDesignVersion || !design.Elements[0].Enabled {
		t.Fatalf("legacy variables should be enabled after migration: %#v", design)
	}
}

func TestBuildNoteExportHTMLPlacesCoverBeforeContent(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	note, err := store.CreateNote(ctx, notebooks[0].ID, "封面文件", "")
	if err != nil {
		t.Fatal(err)
	}
	note.AdditionalInfo[0].Value = "Puff 公司"
	design := defaultPDFCoverDesign()
	design.Enabled = true
	coverHTML, err := buildPDFCoverHTML(note, design, "")
	if err != nil {
		t.Fatal(err)
	}
	document, err := buildNoteExportHTML(
		ctx,
		store,
		note,
		"<p>內容</p>",
		pdfExportDecorations{CoverHTML: coverHTML},
	)
	if err != nil {
		t.Fatal(err)
	}
	coverIndex := strings.Index(document, `<section class="pdf-cover"`)
	contentIndex := strings.Index(document, `<main class="note-shell cover-following"`)
	if coverIndex < 0 || contentIndex < 0 || coverIndex >= contentIndex {
		t.Fatalf("cover must precede content:\n%s", document)
	}
	if !strings.Contains(document, `@page cover { size: A4; margin: 0; }`) ||
		!strings.Contains(document, `.note-shell.cover-following { break-before: page; }`) {
		t.Fatalf("cover page CSS missing:\n%s", document)
	}
}

func TestBuildNoteExportHTMLControlsCoverWatermark(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	note, err := store.CreateNote(ctx, notebooks[0].ID, "浮水印封面", "")
	if err != nil {
		t.Fatal(err)
	}
	design := defaultPDFCoverDesign()
	design.Enabled = true
	coverHTML, err := buildPDFCoverHTML(note, design, "")
	if err != nil {
		t.Fatal(err)
	}
	decorations := buildPDFExportDecorations(
		"",
		"CONFIDENTIAL",
		time.Date(2026, 10, 25, 0, 0, 0, 0, time.Local),
	)
	decorations.CoverHTML = coverHTML

	document, err := buildNoteExportHTML(ctx, store, note, "<p>內容</p>", decorations)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(document, `class="pdf-cover has-watermark"`) ||
		!strings.Contains(document, `class="note-shell cover-following has-background"`) {
		t.Fatalf("cover watermark should be disabled:\n%s", document)
	}

	decorations.CoverWatermark = true
	document, err = buildNoteExportHTML(ctx, store, note, "<p>內容</p>", decorations)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(document, `class="pdf-cover has-watermark"`) ||
		!strings.Contains(document, `class="note-shell cover-following has-background"`) {
		t.Fatalf("cover watermark should be enabled:\n%s", document)
	}
}

func TestBuildPDFCoverHTMLHonorsDisabledVariables(t *testing.T) {
	fields := defaultNoteInfoFields()
	fields[0].Value = "Visible company"
	fields[1].Value = "Hidden number"
	design := defaultPDFCoverDesign()
	design.Enabled = true
	design.Elements[0].Enabled = false
	cover, err := buildPDFCoverHTML(Note{AdditionalInfo: fields}, design, "")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(cover), "Visible company") ||
		!strings.Contains(string(cover), "Hidden number") {
		t.Fatalf("variable enable state was not applied: %s", cover)
	}
}
