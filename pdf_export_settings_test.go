package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"math"
	"regexp"
	"strings"
	"testing"
	"time"
)

var watermarkDataURLPattern = regexp.MustCompile(
	`data:image/svg\+xml;base64,([A-Za-z0-9+/=]+)`,
)

func TestBuildPDFExportDecorationsIncludesTiledWatermarkAndDate(t *testing.T) {
	now := time.Date(2026, 10, 25, 14, 30, 0, 0, time.Local)
	decorations := buildPDFExportDecorations(
		"© 2026 PuffJoplin <internal>",
		"內部文件 & 測試",
		now,
	)

	if decorations.FooterCopyright != "© 2026 PuffJoplin <internal>" {
		t.Fatalf("footer = %q", decorations.FooterCopyright)
	}
	style := string(decorations.WatermarkStyle)
	if !strings.Contains(style, "background-size:900px 600px;") {
		t.Fatalf("watermark tile sizing missing: %s", style)
	}
	match := watermarkDataURLPattern.FindStringSubmatch(style)
	if len(match) != 2 {
		t.Fatalf("watermark data URL missing: %s", style)
	}
	svg, err := base64.StdEncoding.DecodeString(match[1])
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(svg), "內部文件 &amp; 測試") ||
		!strings.Contains(string(svg), "2026-10-25") ||
		!strings.Contains(string(svg), `width="900" height="600"`) ||
		!strings.Contains(string(svg), `font-size="42"`) ||
		!strings.Contains(string(svg), `fill="#C0C0C0"`) ||
		!strings.Contains(string(svg), `transform="translate(`) ||
		!strings.Contains(string(svg), `rotate(-45 450.0 300.0)"`) ||
		!strings.Contains(string(svg), `x="450.0" y="268.5"`) ||
		!strings.Contains(string(svg), `x="450.0" y="331.5"`) ||
		strings.Count(string(svg), "<text ") != 2 {
		t.Fatalf("watermark content = %s", svg)
	}
}

func TestBuildPDFExportDecorationsUsesCustomGeometryAndOpacity(t *testing.T) {
	decorations := buildPDFExportDecorations(
		"",
		"可調浮水印",
		time.Date(2026, 10, 25, 0, 0, 0, 0, time.Local),
		pdfWatermarkConfig{
			Width: 720, Height: 480, FontSize: 30, Opacity: 18, Angle: -30, ShowBorder: true,
		},
	)
	style := string(decorations.WatermarkStyle)
	if !strings.Contains(style, "background-size:720px 480px;") ||
		!strings.Contains(style, "background-position:center center;") {
		t.Fatalf("custom watermark style = %s", style)
	}
	match := watermarkDataURLPattern.FindStringSubmatch(style)
	if len(match) != 2 {
		t.Fatalf("watermark data URL missing: %s", style)
	}
	svg, err := base64.StdEncoding.DecodeString(match[1])
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(svg), `width="720" height="480"`) ||
		!strings.Contains(string(svg), `font-size="30"`) ||
		!strings.Contains(string(svg), `fill-opacity="0.18"`) ||
		!strings.Contains(string(svg), `stroke="#E53935"`) ||
		!strings.Contains(string(svg), `stroke-dasharray="10 6"`) ||
		!strings.Contains(string(svg), `transform="translate(`) ||
		!strings.Contains(string(svg), `rotate(-30 360.0 240.0)"`) ||
		!strings.Contains(string(svg), `x="360.0" y="217.5"`) ||
		!strings.Contains(string(svg), `x="360.0" y="262.5"`) ||
		strings.Count(string(svg), "<text ") != 2 {
		t.Fatalf("custom watermark SVG = %s", svg)
	}
}

func TestPDFWatermarkTextCenterOffsetCentersBothRotatedLines(t *testing.T) {
	offsetX, offsetY := pdfWatermarkTextCenterOffset(280, 200, 60, -45)
	if math.Abs(offsetX-14.1421356237) > 0.0001 ||
		math.Abs(offsetY-14.1421356237) > 0.0001 {
		t.Fatalf("centering offset = (%.6f, %.6f)", offsetX, offsetY)
	}

	equalX, equalY := pdfWatermarkTextCenterOffset(200, 200, 60, -45)
	if math.Abs(equalX) > 0.0001 || math.Abs(equalY) > 0.0001 {
		t.Fatalf("equal-width offset = (%.6f, %.6f)", equalX, equalY)
	}
}

func TestLoadPDFExportDecorationsReadsStoredSettings(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	footer, _ := json.Marshal("Confidential footer")
	watermark, _ := json.Marshal("Confidential")
	if err := store.SetSetting(ctx, pdfFooterCopyrightSetting, string(footer)); err != nil {
		t.Fatal(err)
	}
	if err := store.SetSetting(ctx, pdfWatermarkTextSetting, string(watermark)); err != nil {
		t.Fatal(err)
	}
	if err := store.SetSetting(ctx, pdfFooterEnabledSetting, "true"); err != nil {
		t.Fatal(err)
	}
	if err := store.SetSetting(ctx, pdfWatermarkEnabledSetting, "true"); err != nil {
		t.Fatal(err)
	}

	decorations, err := loadPDFExportDecorations(
		ctx,
		store,
		time.Date(2026, 10, 31, 9, 0, 0, 0, time.Local),
	)
	if err != nil {
		t.Fatal(err)
	}
	if decorations.FooterCopyright != "Confidential footer" ||
		!strings.Contains(string(decorations.WatermarkStyle), "data:image/svg+xml;base64,") {
		t.Fatalf("decorations = %#v", decorations)
	}
}

func TestLoadPDFExportDecorationsUsesSplitDefaults(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	footer, _ := json.Marshal("Hidden footer")
	watermark, _ := json.Marshal("Hidden watermark")
	if err := store.SetSetting(ctx, pdfFooterCopyrightSetting, string(footer)); err != nil {
		t.Fatal(err)
	}
	if err := store.SetSetting(ctx, pdfWatermarkTextSetting, string(watermark)); err != nil {
		t.Fatal(err)
	}

	decorations, err := loadPDFExportDecorations(ctx, store, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if decorations.FooterCopyright != "Hidden footer" ||
		decorations.WatermarkStyle != "" ||
		decorations.BodyBackgroundStyle != "" {
		t.Fatalf("unexpected split defaults: %#v", decorations)
	}
}

func TestLoadPDFExportDecorationsSupportsWatermarkWithoutFooter(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	watermark, _ := json.Marshal("Visible watermark")
	if err := store.SetSetting(ctx, pdfWatermarkTextSetting, string(watermark)); err != nil {
		t.Fatal(err)
	}
	if err := store.SetSetting(ctx, pdfFooterEnabledSetting, "false"); err != nil {
		t.Fatal(err)
	}
	if err := store.SetSetting(ctx, pdfWatermarkEnabledSetting, "true"); err != nil {
		t.Fatal(err)
	}
	decorations, err := loadPDFExportDecorations(ctx, store, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if decorations.FooterCopyright != "" ||
		!strings.Contains(string(decorations.WatermarkStyle), "data:image/svg+xml;base64,") {
		t.Fatalf("unexpected independent settings: %#v", decorations)
	}
}

func TestBuildNoteExportHTMLOnlyAddsDecorationsWhenRequested(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	note, err := store.CreateNote(ctx, notebooks[0].ID, "PDF decorations", "")
	if err != nil {
		t.Fatal(err)
	}
	content := `<p>Body</p>`
	plain, err := buildNoteExportHTML(ctx, store, note, content)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(plain, `<footer class="pdf-footer"`) ||
		strings.Contains(plain, `class="note-shell has-background"`) ||
		strings.Contains(plain, `class="pdf-cover has-watermark"`) {
		t.Fatal("HTML export unexpectedly contains PDF decorations")
	}

	decorations := buildPDFExportDecorations(
		"© 2026 <Owner>",
		"CONFIDENTIAL",
		time.Date(2026, 10, 25, 0, 0, 0, 0, time.Local),
	)
	document, err := buildNoteExportHTML(ctx, store, note, content, decorations)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(document, `class="note-shell has-background"`) ||
		strings.Contains(document, "pdf-watermark-layer") {
		t.Fatalf("PDF decorations missing: %s", document)
	}
	footerTemplate := pdfFooterHTMLTemplate("© 2026 <Owner>")
	if !strings.Contains(footerTemplate, "© 2026 &lt;Owner&gt;") ||
		!strings.Contains(footerTemplate, "text-align:center") {
		t.Fatalf("footer template = %s", footerTemplate)
	}
}

func TestSanitizePDFSettingTextEnforcesLimits(t *testing.T) {
	if got := sanitizePDFSettingText("  A\n B  ", pdfFooterMaxLength); got != "A B" {
		t.Fatalf("sanitized text = %q", got)
	}
	if got := []rune(sanitizePDFSettingText(strings.Repeat("浮", 100), pdfWatermarkMaxLength)); len(got) != 80 {
		t.Fatalf("watermark limit = %d", len(got))
	}
}
