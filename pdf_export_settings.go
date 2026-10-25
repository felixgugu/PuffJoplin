package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html"
	"html/template"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/image/font"
	"golang.org/x/image/font/sfnt"
	"golang.org/x/image/math/fixed"
)

const (
	pdfFooterCopyrightSetting     = "pdf.footerCopyright"
	pdfWatermarkTextSetting       = "pdf.watermarkText"
	pdfFooterEnabledSetting       = "pdf.footerEnabled"
	pdfWatermarkEnabledSetting    = "pdf.watermarkEnabled"
	pdfWatermarkWidthSetting      = "pdf.watermarkWidth"
	pdfWatermarkHeightSetting     = "pdf.watermarkHeight"
	pdfWatermarkFontSizeSetting   = "pdf.watermarkFontSize"
	pdfWatermarkOpacitySetting    = "pdf.watermarkOpacity"
	pdfWatermarkAngleSetting      = "pdf.watermarkAngle"
	pdfWatermarkShowBorderSetting = "pdf.watermarkShowBorder"
	pdfFooterMaxLength            = 200
	pdfWatermarkMaxLength         = 80
	defaultPDFWatermarkWidth      = 900
	defaultPDFWatermarkHeight     = 600
	defaultPDFWatermarkFontSize   = 42
	defaultPDFWatermarkOpacity    = 10
	defaultPDFWatermarkAngle      = -45
	minPDFWatermarkWidth          = 300
	maxPDFWatermarkWidth          = 2000
	minPDFWatermarkHeight         = 200
	maxPDFWatermarkHeight         = 2000
	minPDFWatermarkFontSize       = 16
	maxPDFWatermarkFontSize       = 120
	minPDFWatermarkOpacity        = 1
	maxPDFWatermarkOpacity        = 30
	minPDFWatermarkAngle          = -90
	maxPDFWatermarkAngle          = 90
)

type pdfExportDecorations struct {
	FooterCopyright     string
	WatermarkStyle      template.CSS
	BodyBackgroundStyle template.CSS
	WatermarkImageURL   string
	WatermarkWidth      int
	WatermarkHeight     int
	CoverHTML           template.HTML
	CoverWatermark      bool
}

type pdfWatermarkConfig struct {
	Width      int
	Height     int
	FontSize   int
	Opacity    int
	Angle      int
	ShowBorder bool
}

func loadPDFExportDecorations(
	ctx context.Context,
	store *Store,
	now time.Time,
) (pdfExportDecorations, error) {
	footer, _, err := store.GetSetting(ctx, pdfFooterCopyrightSetting)
	if err != nil {
		return pdfExportDecorations{}, fmt.Errorf("讀取 PDF 頁尾設定: %w", err)
	}
	watermark, _, err := store.GetSetting(ctx, pdfWatermarkTextSetting)
	if err != nil {
		return pdfExportDecorations{}, fmt.Errorf("讀取 PDF 浮水印設定: %w", err)
	}
	footerEnabled, err := readPDFBooleanSetting(ctx, store, pdfFooterEnabledSetting, true)
	if err != nil {
		return pdfExportDecorations{}, err
	}
	watermarkEnabled, err := readPDFBooleanSetting(ctx, store, pdfWatermarkEnabledSetting, false)
	if err != nil {
		return pdfExportDecorations{}, err
	}
	width, err := readPDFIntegerSetting(
		ctx,
		store,
		pdfWatermarkWidthSetting,
		defaultPDFWatermarkWidth,
		minPDFWatermarkWidth,
		maxPDFWatermarkWidth,
	)
	if err != nil {
		return pdfExportDecorations{}, err
	}
	height, err := readPDFIntegerSetting(
		ctx,
		store,
		pdfWatermarkHeightSetting,
		defaultPDFWatermarkHeight,
		minPDFWatermarkHeight,
		maxPDFWatermarkHeight,
	)
	if err != nil {
		return pdfExportDecorations{}, err
	}
	fontSize, err := readPDFIntegerSetting(
		ctx,
		store,
		pdfWatermarkFontSizeSetting,
		defaultPDFWatermarkFontSize,
		minPDFWatermarkFontSize,
		maxPDFWatermarkFontSize,
	)
	if err != nil {
		return pdfExportDecorations{}, err
	}
	opacity, err := readPDFIntegerSetting(
		ctx,
		store,
		pdfWatermarkOpacitySetting,
		defaultPDFWatermarkOpacity,
		minPDFWatermarkOpacity,
		maxPDFWatermarkOpacity,
	)
	if err != nil {
		return pdfExportDecorations{}, err
	}
	angle, err := readPDFIntegerSetting(
		ctx,
		store,
		pdfWatermarkAngleSetting,
		defaultPDFWatermarkAngle,
		minPDFWatermarkAngle,
		maxPDFWatermarkAngle,
	)
	if err != nil {
		return pdfExportDecorations{}, err
	}
	showBorderValue, _, err := store.GetSetting(ctx, pdfWatermarkShowBorderSetting)
	if err != nil {
		return pdfExportDecorations{}, fmt.Errorf("讀取 PDF 浮水印邊框設定: %w", err)
	}
	footerValue := ""
	if footerEnabled {
		footerValue = decodePDFSettingValue(footer)
	}
	watermarkValue := ""
	if watermarkEnabled {
		watermarkValue = decodePDFSettingValue(watermark)
	}
	return buildPDFExportDecorations(
		footerValue,
		watermarkValue,
		now,
		pdfWatermarkConfig{
			Width: width, Height: height, FontSize: fontSize, Opacity: opacity, Angle: angle,
			ShowBorder: decodePDFSettingEnabled(showBorderValue),
		},
	), nil
}

func readPDFBooleanSetting(
	ctx context.Context,
	store *Store,
	key string,
	fallback bool,
) (bool, error) {
	value, exists, err := store.GetSetting(ctx, key)
	if err != nil {
		return false, fmt.Errorf("讀取 PDF 設定 %s: %w", key, err)
	}
	if !exists || strings.TrimSpace(value) == "" {
		return fallback, nil
	}
	return decodePDFSettingEnabled(value), nil
}

func readPDFIntegerSetting(
	ctx context.Context,
	store *Store,
	key string,
	fallback int,
	minimum int,
	maximum int,
) (int, error) {
	value, _, err := store.GetSetting(ctx, key)
	if err != nil {
		return 0, fmt.Errorf("讀取 PDF 設定 %s: %w", key, err)
	}
	parsed, err := strconv.Atoi(strings.Trim(strings.TrimSpace(value), `"`))
	if err != nil {
		parsed = fallback
	}
	return clampPDFInteger(parsed, minimum, maximum), nil
}

func decodePDFSettingEnabled(value string) bool {
	var enabled bool
	if err := json.Unmarshal([]byte(value), &enabled); err == nil {
		return enabled
	}
	return strings.EqualFold(strings.Trim(value, `"`), "true")
}

func buildPDFExportDecorations(
	footerValue string,
	watermarkValue string,
	now time.Time,
	configs ...pdfWatermarkConfig,
) pdfExportDecorations {
	decorations := pdfExportDecorations{
		FooterCopyright: sanitizePDFSettingText(footerValue, pdfFooterMaxLength),
	}
	watermarkText := sanitizePDFSettingText(watermarkValue, pdfWatermarkMaxLength)
	if watermarkText == "" {
		decorations.BodyBackgroundStyle = buildPDFBodyBackgroundStyle(decorations)
		return decorations
	}
	config := pdfWatermarkConfig{
		Width:      defaultPDFWatermarkWidth,
		Height:     defaultPDFWatermarkHeight,
		FontSize:   defaultPDFWatermarkFontSize,
		Opacity:    defaultPDFWatermarkOpacity,
		Angle:      defaultPDFWatermarkAngle,
		ShowBorder: false,
	}
	if len(configs) > 0 {
		config = configs[0]
	}
	config.Width = clampPDFInteger(config.Width, minPDFWatermarkWidth, maxPDFWatermarkWidth)
	config.Height = clampPDFInteger(config.Height, minPDFWatermarkHeight, maxPDFWatermarkHeight)
	config.FontSize = clampPDFInteger(
		config.FontSize,
		minPDFWatermarkFontSize,
		maxPDFWatermarkFontSize,
	)
	config.Opacity = clampPDFInteger(
		config.Opacity,
		minPDFWatermarkOpacity,
		maxPDFWatermarkOpacity,
	)
	config.Angle = clampPDFInteger(
		config.Angle,
		minPDFWatermarkAngle,
		maxPDFWatermarkAngle,
	)
	watermarkDate := now.In(time.Local).Format("2006-01-02")
	svg := buildPDFWatermarkSVG(watermarkText, watermarkDate, config)
	encoded := base64.StdEncoding.EncodeToString(svg)
	decorations.WatermarkStyle = template.CSS(fmt.Sprintf(
		`background-image:url("data:image/svg+xml;base64,%s");background-size:%dpx %dpx;background-position:center center;`,
		encoded,
		config.Width,
		config.Height,
	))
	decorations.WatermarkImageURL = "data:image/svg+xml;base64," + encoded
	decorations.WatermarkWidth = config.Width
	decorations.WatermarkHeight = config.Height
	decorations.BodyBackgroundStyle = buildPDFBodyBackgroundStyle(decorations)
	return decorations
}

func buildPDFBodyBackgroundStyle(decorations pdfExportDecorations) template.CSS {
	images := make([]string, 0, 2)
	sizes := make([]string, 0, 2)
	repeats := make([]string, 0, 2)
	positions := make([]string, 0, 2)
	if decorations.WatermarkImageURL != "" {
		images = append(images, fmt.Sprintf(`url("%s")`, decorations.WatermarkImageURL))
		sizes = append(
			sizes,
			fmt.Sprintf("%dpx %dpx", decorations.WatermarkWidth, decorations.WatermarkHeight),
		)
		repeats = append(repeats, "repeat")
		positions = append(positions, "center center")
	}
	if len(images) == 0 {
		return ""
	}
	return template.CSS(fmt.Sprintf(
		`background-image:%s;background-size:%s;background-repeat:%s;background-position:%s;`,
		strings.Join(images, ","),
		strings.Join(sizes, ","),
		strings.Join(repeats, ","),
		strings.Join(positions, ","),
	))
}

func pdfFooterHTMLTemplate(copyright string) string {
	copyright = strings.TrimSpace(copyright)
	if copyright == "" {
		return "<span></span>"
	}
	return `<div style="width:100%;padding:0 17mm 4mm;color:#666666;font-family:'Microsoft JhengHei UI','Segoe UI',sans-serif;font-size:9px;line-height:1.4;text-align:center;">` +
		html.EscapeString(copyright) +
		`</div>`
}

func clampPDFInteger(value int, minimum int, maximum int) int {
	if value < minimum {
		return minimum
	}
	if value > maximum {
		return maximum
	}
	return value
}

func decodePDFSettingValue(value string) string {
	var decoded string
	if err := json.Unmarshal([]byte(value), &decoded); err == nil {
		return decoded
	}
	return strings.Trim(value, `"`)
}

func sanitizePDFSettingText(value string, maxLength int) string {
	value = strings.Map(func(character rune) rune {
		if character < 0x20 || character == 0x7f {
			return ' '
		}
		return character
	}, value)
	value = strings.Join(strings.Fields(value), " ")
	runes := []rune(value)
	if len(runes) > maxLength {
		runes = runes[:maxLength]
	}
	return string(runes)
}

func buildPDFWatermarkSVG(
	text string,
	date string,
	config pdfWatermarkConfig,
) []byte {
	lineHeight := float64(config.FontSize) * 1.5
	var markup strings.Builder
	fmt.Fprintf(
		&markup,
		`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">`,
		config.Width,
		config.Height,
		config.Width,
		config.Height,
	)
	if config.ShowBorder {
		fmt.Fprintf(
			&markup,
			`<rect x="1" y="1" width="%d" height="%d" fill="none" stroke="#E53935" stroke-width="2" stroke-dasharray="10 6"/>`,
			config.Width-2,
			config.Height-2,
		)
	}
	escapedText := html.EscapeString(text)
	escapedDate := html.EscapeString(date)
	textOpacity := float64(config.Opacity) / 100
	centerX := float64(config.Width) / 2
	centerY := float64(config.Height) / 2
	firstLineY := centerY - lineHeight/2
	secondLineY := centerY + lineHeight/2
	offsetX, offsetY := pdfWatermarkTextCenterOffset(
		measurePDFWatermarkTextWidth(text, config.FontSize),
		measurePDFWatermarkTextWidth(date, config.FontSize),
		lineHeight,
		config.Angle,
	)
	fmt.Fprintf(
		&markup,
		`<g transform="translate(%.2f %.2f) rotate(%d %.1f %.1f)" fill="#C0C0C0" fill-opacity="%.2f" font-family="Segoe UI, Microsoft JhengHei UI, sans-serif">`+
			`<text x="%.1f" y="%.1f" text-anchor="middle" dominant-baseline="central" font-size="%d" font-weight="500">%s</text>`+
			`<text x="%.1f" y="%.1f" text-anchor="middle" dominant-baseline="central" font-size="%d" font-weight="400">%s</text>`+
			`</g>`,
		offsetX,
		offsetY,
		config.Angle,
		centerX,
		centerY,
		textOpacity,
		centerX,
		firstLineY,
		config.FontSize,
		escapedText,
		centerX,
		secondLineY,
		config.FontSize,
		escapedDate,
	)
	markup.WriteString(`</svg>`)
	return []byte(markup.String())
}

// pdfWatermarkTextCenterOffset compensates for the visual bounds of two
// differently sized, centered lines after rotation. SVG rotates each line
// around the tile center, but the longer line dominates the combined visual
// bounding box and otherwise makes the text block appear offset.
func pdfWatermarkTextCenterOffset(
	firstWidth float64,
	secondWidth float64,
	lineHeight float64,
	angleDegrees int,
) (float64, float64) {
	radians := float64(angleDegrees) * math.Pi / 180
	cosine := math.Cos(radians)
	sine := math.Sin(radians)
	lines := [][2]float64{
		{firstWidth / 2, -lineHeight / 2},
		{secondWidth / 2, lineHeight / 2},
	}
	minimumX := math.Inf(1)
	maximumX := math.Inf(-1)
	minimumY := math.Inf(1)
	maximumY := math.Inf(-1)
	for _, line := range lines {
		halfWidth := line[0]
		lineY := line[1]
		x1 := -halfWidth*cosine - lineY*sine
		x2 := halfWidth*cosine - lineY*sine
		y1 := -halfWidth*sine + lineY*cosine
		y2 := halfWidth*sine + lineY*cosine
		minimumX = math.Min(minimumX, math.Min(x1, x2))
		maximumX = math.Max(maximumX, math.Max(x1, x2))
		minimumY = math.Min(minimumY, math.Min(y1, y2))
		maximumY = math.Max(maximumY, math.Max(y1, y2))
	}
	return -(minimumX + maximumX) / 2, -(minimumY + maximumY) / 2
}

type pdfWatermarkMeasurementFont struct {
	once sync.Once
	font *sfnt.Font
	data []byte
}

var pdfWatermarkSystemFont pdfWatermarkMeasurementFont

func measurePDFWatermarkTextWidth(text string, fontSize int) float64 {
	loadedFont := loadPDFWatermarkMeasurementFont()
	if loadedFont == nil {
		return estimatePDFWatermarkTextWidth(text, fontSize)
	}

	ppem := fixed.I(fontSize)
	buffer := &sfnt.Buffer{}
	previousGlyph := sfnt.GlyphIndex(0)
	hasPreviousGlyph := false
	width := float64(0)
	for _, character := range text {
		glyph, err := loadedFont.GlyphIndex(buffer, character)
		if err != nil || glyph == 0 {
			width += float64(fontSize)
			hasPreviousGlyph = false
			continue
		}
		advance, err := loadedFont.GlyphAdvance(
			buffer,
			glyph,
			ppem,
			font.HintingNone,
		)
		if err != nil {
			width += float64(fontSize)
			hasPreviousGlyph = false
			continue
		}
		width += float64(advance) / 64
		if hasPreviousGlyph {
			kerning, err := loadedFont.Kern(
				buffer,
				previousGlyph,
				glyph,
				ppem,
				font.HintingNone,
			)
			if err == nil {
				width += float64(kerning) / 64
			}
		}
		previousGlyph = glyph
		hasPreviousGlyph = true
	}
	return width
}

func loadPDFWatermarkMeasurementFont() *sfnt.Font {
	pdfWatermarkSystemFont.once.Do(func() {
		windowsDirectory := strings.TrimSpace(os.Getenv("WINDIR"))
		if windowsDirectory == "" {
			windowsDirectory = `C:\Windows`
		}
		data, err := os.ReadFile(filepath.Join(windowsDirectory, "Fonts", "segoeui.ttf"))
		if err != nil {
			return
		}
		parsed, err := sfnt.Parse(data)
		if err != nil {
			return
		}
		pdfWatermarkSystemFont.data = data
		pdfWatermarkSystemFont.font = parsed
	})
	return pdfWatermarkSystemFont.font
}

func estimatePDFWatermarkTextWidth(text string, fontSize int) float64 {
	width := float64(0)
	for _, character := range text {
		switch {
		case character == ' ', character == '\t':
			width += float64(fontSize) * 0.3
		case character < 0x80:
			width += float64(fontSize) * 0.58
		default:
			width += float64(fontSize)
		}
	}
	return width
}
