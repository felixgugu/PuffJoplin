package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestBuildNoteExportHTMLSanitizesAndEmbedsResources(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	note, err := store.CreateNote(ctx, notebooks[0].ID, "匯出 <測試>", "")
	if err != nil {
		t.Fatal(err)
	}
	resource, err := store.AddResourceData(ctx, note.ID, "photo.png", []byte("\x89PNG\r\n\x1a\nimage"))
	if err != nil {
		t.Fatal(err)
	}
	content := `<h1>標題</h1><script>alert(1)</script>` +
		`<p><img src="/resources/` + resource.ID + `" alt="photo"></p>` +
		`<p><a href="https://example.com/resources/` + resource.ID + `">remote</a></p>` +
		`<p><a href=":/` + resource.ID + `">attachment</a></p>`

	document, err := buildNoteExportHTML(ctx, store, note, content)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(strings.ToLower(document), "<script") {
		t.Fatal("script tag survived HTML sanitization")
	}
	if !strings.Contains(document, "data:image/png;base64,") {
		t.Fatal("local resource was not embedded")
	}
	if !strings.Contains(document, "https://example.com/resources/"+resource.ID) {
		t.Fatal("remote resource URL was rewritten")
	}
	if !strings.Contains(document, "&lt;測試&gt;") {
		t.Fatal("note title was not HTML-escaped")
	}
	if !strings.Contains(document, "@page { size: A4;") {
		t.Fatal("print stylesheet is missing")
	}
}

func TestBuildNoteExportHTMLRejectsMissingResource(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	note, err := store.CreateNote(ctx, notebooks[0].ID, "Missing resource", "")
	if err != nil {
		t.Fatal(err)
	}
	missingID := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	_, err = buildNoteExportHTML(ctx, store, note, `<img src="/resources/`+missingID+`">`)
	if err == nil || !strings.Contains(err.Error(), missingID) {
		t.Fatalf("expected missing resource error, got %v", err)
	}
}

func TestRenderNotePDFKeepsTextAndOutline(t *testing.T) {
	browserPath, err := findPDFBrowser()
	if err != nil {
		t.Skip(err)
	}
	document := `<!doctype html><html><head><meta charset="utf-8"><style>` +
		`@page{size:A4;margin:18mm}body{font-family:"Microsoft JhengHei UI",sans-serif}</style></head>` +
		`<body><h1>PDF 測試標題</h1><h2>第一章</h2><p>可選取的中文文字</p>` +
		`<h2>第二章</h2><p>Second section</p></body></html>`
	output := filepath.Join(t.TempDir(), "outline.pdf")
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if err := renderNotePDF(ctx, document, output, browserPath); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(output)
	if err != nil {
		t.Fatal(err)
	}
	if len(data) < 1024 || !bytes.HasPrefix(data, []byte("%PDF-")) {
		t.Fatalf("invalid PDF output: %d bytes", len(data))
	}
	if !bytes.Contains(data, []byte("/Outlines")) {
		t.Fatal("PDF outline was not generated")
	}
	if !bytes.Contains(data, []byte("/Font")) {
		t.Fatal("PDF does not contain embedded text fonts")
	}
}

func TestRenderNotePDFVisualSmoke(t *testing.T) {
	output := strings.TrimSpace(os.Getenv("PUFFJOPLIN_PDF_SMOKE_OUTPUT"))
	if output == "" {
		t.Skip("set PUFFJOPLIN_PDF_SMOKE_OUTPUT to generate a visual smoke-test PDF")
	}
	browserPath, err := findPDFBrowser()
	if err != nil {
		t.Skip(err)
	}
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	note, err := store.CreateNote(context.Background(), notebooks[0].ID, "PuffJoplin PDF 匯出測試", "")
	if err != nil {
		t.Fatal(err)
	}
	imageData, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3Q6wAAAABJRU5ErkJggg==")
	if err != nil {
		t.Fatal(err)
	}
	resource, err := store.AddResourceData(context.Background(), note.ID, "sample.png", imageData)
	if err != nil {
		t.Fatal(err)
	}
	content := `<h1>文件標題</h1><p>這是一段中文內容，用於檢查 PDF 可選文字與字型。</p>` +
		`<img src="/resources/` + resource.ID + `" alt="sample">` +
		`<h2>第一章</h2><p>段落內容。</p>` +
		`<table><thead><tr><th>項目</th><th>狀態</th></tr></thead><tbody><tr><td>PDF</td><td>完成</td></tr></tbody></table>` +
		`<pre><code>fmt.Println("hello")</code></pre><h2>第二章</h2><p>結尾。</p>`
	document, err := buildNoteExportHTML(context.Background(), store, note, content)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if err := renderNotePDF(ctx, document, output, browserPath); err != nil {
		t.Fatal(err)
	}
}
