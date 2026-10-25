package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"math"
	"strings"
)

const (
	pdfCoverDesignSetting    = "pdf.coverDesign"
	pdfCoverDesignVersion    = 2
	pdfCoverGlobalFooterKey  = "globalFooterCopyright"
	pdfCoverPageWidthMM      = 210.0
	pdfCoverPageHeightMM     = 297.0
	minPDFCoverFontSizePT    = 8.0
	maxPDFCoverFontSizePT    = 48.0
	pdfCoverDefaultLineStyle = "normal"
)

type PDFCoverElement struct {
	Key       string  `json:"key"`
	Enabled   bool    `json:"enabled"`
	XMm       float64 `json:"xMm"`
	YMm       float64 `json:"yMm"`
	FontSize  float64 `json:"fontSize"`
	Alignment string  `json:"alignment"`
	ShowLabel bool    `json:"showLabel"`
}

type PDFCoverDesign struct {
	Version          int               `json:"version"`
	Enabled          bool              `json:"enabled"`
	IncludeWatermark bool              `json:"includeWatermark"`
	Elements         []PDFCoverElement `json:"elements"`
}

type pdfCoverRenderField struct {
	Key       string
	Text      string
	XMm       float64
	YMm       float64
	FontSize  float64
	Alignment string
	Style     string
}

func defaultPDFCoverDesign() PDFCoverDesign {
	elements := []PDFCoverElement{
		{Key: noteInfoCompanyName, Enabled: true, XMm: 25, YMm: 25.6, FontSize: 15, Alignment: "left"},
		{Key: noteInfoDocumentNumber, Enabled: true, XMm: 185, YMm: 41.3, FontSize: 10, Alignment: "right", ShowLabel: true},
		{Key: noteInfoVersion, Enabled: true, XMm: 112, YMm: 49.7, FontSize: 10, Alignment: "left", ShowLabel: true},
		{Key: noteInfoClassification, Enabled: true, XMm: 151, YMm: 49.7, FontSize: 10, Alignment: "left", ShowLabel: true},
		{Key: noteInfoDocumentTitle, Enabled: true, XMm: 105, YMm: 93.7, FontSize: 30, Alignment: "center"},
		{Key: noteInfoSubtitle, Enabled: true, XMm: 105, YMm: 121, FontSize: 16, Alignment: "center"},
		{Key: noteInfoScope, Enabled: true, XMm: 105, YMm: 138.1, FontSize: 11, Alignment: "center"},
		{Key: noteInfoPreparedByUnit, Enabled: true, XMm: 55, YMm: 181, FontSize: 11, Alignment: "left", ShowLabel: true},
		{Key: noteInfoPreparedBy, Enabled: true, XMm: 55, YMm: 194.5, FontSize: 11, Alignment: "left", ShowLabel: true},
		{Key: noteInfoSubmittedTo, Enabled: true, XMm: 55, YMm: 208, FontSize: 11, Alignment: "left", ShowLabel: true},
		{Key: noteInfoIssueDate, Enabled: true, XMm: 55, YMm: 221.5, FontSize: 11, Alignment: "left", ShowLabel: true},
		{Key: noteInfoFooterText, Enabled: true, XMm: 105, YMm: 280.7, FontSize: 8, Alignment: "center"},
		{Key: pdfCoverGlobalFooterKey, Enabled: true, XMm: 105, YMm: 275.5, FontSize: 8, Alignment: "center"},
	}
	return PDFCoverDesign{
		Version:  pdfCoverDesignVersion,
		Enabled:  false,
		Elements: elements,
	}
}

func normalizePDFCoverDesign(design PDFCoverDesign) PDFCoverDesign {
	defaults := defaultPDFCoverDesign()
	legacyVersion := design.Version < pdfCoverDesignVersion
	byKey := make(map[string]PDFCoverElement, len(design.Elements))
	for _, element := range design.Elements {
		key := strings.TrimSpace(element.Key)
		if _, ok := pdfCoverElementDefault(key); ok {
			byKey[key] = element
		}
	}
	normalized := make([]PDFCoverElement, 0, len(defaults.Elements))
	for _, fallback := range defaults.Elements {
		element, exists := byKey[fallback.Key]
		if !exists {
			normalized = append(normalized, fallback)
			continue
		}
		element.Key = fallback.Key
		if legacyVersion {
			element.Enabled = true
		}
		element.XMm = clampPDFCoverNumber(element.XMm, 0, pdfCoverPageWidthMM, fallback.XMm)
		element.YMm = clampPDFCoverNumber(element.YMm, 0, pdfCoverPageHeightMM, fallback.YMm)
		element.FontSize = clampPDFCoverNumber(
			element.FontSize,
			minPDFCoverFontSizePT,
			maxPDFCoverFontSizePT,
			fallback.FontSize,
		)
		switch element.Alignment {
		case "left", "center", "right":
		default:
			element.Alignment = fallback.Alignment
		}
		normalized = append(normalized, element)
	}
	return PDFCoverDesign{
		Version:          pdfCoverDesignVersion,
		Enabled:          design.Enabled,
		IncludeWatermark: design.IncludeWatermark,
		Elements:         normalized,
	}
}

func clampPDFCoverNumber(value float64, minimum float64, maximum float64, fallback float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return fallback
	}
	value = math.Round(value*10) / 10
	if value < minimum {
		return minimum
	}
	if value > maximum {
		return maximum
	}
	return value
}

func pdfCoverElementDefault(key string) (PDFCoverElement, bool) {
	for _, element := range defaultPDFCoverDesign().Elements {
		if element.Key == key {
			return element, true
		}
	}
	return PDFCoverElement{}, false
}

func decodePDFCoverDesign(value string) PDFCoverDesign {
	if strings.TrimSpace(value) == "" {
		return defaultPDFCoverDesign()
	}
	var design PDFCoverDesign
	if err := json.Unmarshal([]byte(value), &design); err != nil {
		return defaultPDFCoverDesign()
	}
	return normalizePDFCoverDesign(design)
}

func loadPDFCoverDesign(
	ctx context.Context,
	store *Store,
) (PDFCoverDesign, string, error) {
	value, _, err := store.GetSetting(ctx, pdfCoverDesignSetting)
	if err != nil {
		return PDFCoverDesign{}, "", fmt.Errorf("讀取 PDF 封面設定: %w", err)
	}
	footer, _, err := store.GetSetting(ctx, pdfFooterCopyrightSetting)
	if err != nil {
		return PDFCoverDesign{}, "", fmt.Errorf("讀取 PDF 頁尾設定: %w", err)
	}
	return decodePDFCoverDesign(value), decodePDFSettingValue(footer), nil
}

func buildPDFCoverHTML(
	note Note,
	design PDFCoverDesign,
	globalFooterCopyright string,
) (template.HTML, error) {
	design = normalizePDFCoverDesign(design)
	if !design.Enabled {
		return "", nil
	}
	infoByKey := make(map[string]NoteInfoField, len(note.AdditionalInfo))
	for _, field := range normalizeNoteInfoFields(note.AdditionalInfo) {
		infoByKey[field.Key] = field
	}
	fields := make([]pdfCoverRenderField, 0, len(design.Elements))
	for _, element := range design.Elements {
		if !element.Enabled {
			continue
		}
		text, style := pdfCoverElementText(
			element,
			infoByKey,
			strings.TrimSpace(note.Title),
			sanitizePDFSettingText(globalFooterCopyright, pdfFooterMaxLength),
		)
		if text == "" {
			continue
		}
		fields = append(fields, pdfCoverRenderField{
			Key:       element.Key,
			Text:      text,
			XMm:       element.XMm,
			YMm:       element.YMm,
			FontSize:  element.FontSize,
			Alignment: element.Alignment,
			Style:     style,
		})
	}
	coverTemplate, err := template.New("pdf-cover").Parse(
		`{{range .}}<div class="pdf-cover-field pdf-cover-{{.Style}} is-{{.Alignment}}" ` +
			`style="left:{{printf "%.1f" .XMm}}mm;top:{{printf "%.1f" .YMm}}mm;font-size:{{printf "%.1f" .FontSize}}pt">{{.Text}}</div>{{end}}`,
	)
	if err != nil {
		return "", err
	}
	var rendered bytes.Buffer
	if err := coverTemplate.Execute(&rendered, fields); err != nil {
		return "", err
	}
	return template.HTML(rendered.String()), nil
}

func pdfCoverElementText(
	element PDFCoverElement,
	infoByKey map[string]NoteInfoField,
	noteTitle string,
	globalFooterCopyright string,
) (string, string) {
	if element.Key == pdfCoverGlobalFooterKey {
		return globalFooterCopyright, "copyright"
	}
	field, ok := infoByKey[element.Key]
	if !ok {
		return "", "body"
	}
	value := strings.TrimSpace(field.Value)
	if element.Key == noteInfoDocumentTitle {
		if value == "" {
			value = noteTitle
		}
		if value == "" {
			value = "未命名筆記"
		}
	}
	if value == "" {
		return "", "body"
	}
	label := strings.TrimSpace(field.Label)
	if label == "" {
		definition, _ := noteInfoDefinitionFor(element.Key)
		label = definition.DefaultLabel
	}
	text := value
	if element.ShowLabel && label != "" {
		text = label + "：" + value
	}
	switch element.Key {
	case noteInfoCompanyName:
		return text, "company"
	case noteInfoDocumentTitle:
		return text, "title"
	case noteInfoSubtitle:
		return text, "subtitle"
	case noteInfoFooterText:
		return text, "footer"
	default:
		return text, "body"
	}
}

func validatePDFCoverDesignJSON(value string) error {
	if strings.TrimSpace(value) == "" {
		return errors.New("封面設定不可為空")
	}
	var design PDFCoverDesign
	if err := json.Unmarshal([]byte(value), &design); err != nil {
		return err
	}
	return nil
}
