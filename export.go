package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"html/template"
	"io"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/microcosm-cc/bluemonday"
	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

const noteExportCSS = `
:root {
  color-scheme: light;
  font-family: "Segoe UI Variable Text", "Segoe UI", "Microsoft JhengHei UI", sans-serif;
  color: #1b1b1b;
  background: #ffffff;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #ffffff; }
body { font-size: 14px; line-height: 1.75; }
.note-shell { max-width: 860px; margin: 0 auto; padding: 32px 28px 56px; }
.note-kicker {
  margin-bottom: 8px;
  color: #666666;
  font-size: 11px;
  letter-spacing: 0.04em;
}
.note-title {
  margin: 0 0 24px;
  padding-bottom: 14px;
  border-bottom: 1px solid #dedede;
  font-size: 30px;
  line-height: 1.2;
}
.note-content { overflow-wrap: anywhere; }
.note-content h1, .note-content h2, .note-content h3,
.note-content h4, .note-content h5, .note-content h6 {
  margin: 1.4em 0 0.55em;
  line-height: 1.25;
  break-after: avoid-page;
}
.note-content h1 { font-size: 2em; }
.note-content h2 { font-size: 1.6em; padding-bottom: 0.2em; border-bottom: 1px solid #e4e4e4; }
.note-content h3 { font-size: 1.3em; }
.note-content p { margin: 0.65em 0; }
.note-content a { color: #0067c0; text-decoration: underline; }
.note-content img { max-width: 100%; height: auto; border-radius: 6px; break-inside: avoid-page; }
.note-content blockquote {
  margin: 1em 0;
  padding: 0.2em 1em;
  border-left: 3px solid #0067c0;
  background: #f5f8fb;
  color: #505050;
  break-inside: avoid-page;
}
.note-content code {
  border-radius: 4px;
  background: #f2f3f5;
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 0.9em;
}
.note-content code { padding: 0.12em 0.35em; }
.note-content pre {
  overflow: hidden;
  padding: 12px 14px;
  border: 1px solid #e2e2e2;
  border-radius: 7px;
  background: #f7f8fa;
  white-space: pre-wrap;
  word-break: break-word;
  break-inside: avoid-page;
}
.note-content pre code { padding: 0; background: transparent; }
.note-content table { width: 100%; border-collapse: collapse; break-inside: avoid-page; }
.note-content th, .note-content td { padding: 6px 8px; border: 1px solid #d8d8d8; vertical-align: top; }
.note-content th { background: #f4f4f4; }
.note-content hr { border: 0; border-top: 1px solid #dedede; }
.note-content .vditor-toc { padding-left: 1.2em; }
.pdf-cover {
  page: cover;
  position: relative;
  width: 210mm;
  height: 297mm;
  overflow: hidden;
  break-after: page;
  background: #ffffff;
  color: #000000;
  font-family: "Noto Sans TC", "Microsoft JhengHei UI", "Segoe UI", sans-serif;
}
.pdf-cover-field {
  position: absolute;
  width: max-content;
  max-width: 200mm;
  overflow-wrap: anywhere;
  line-height: 1.25;
  white-space: nowrap;
}
.pdf-cover-field.is-center {
  width: 200mm;
  transform: translateX(-50%);
  text-align: center;
  white-space: normal;
}
.pdf-cover-field.is-right { transform: translateX(-100%); text-align: right; }
.pdf-cover-company { font-weight: 600; }
.pdf-cover-title {
  width: 200mm;
  font-weight: 700;
  line-height: 1.15;
  white-space: normal;
}
.pdf-cover-subtitle {
  width: 200mm;
  line-height: 1.25;
  white-space: normal;
}
.pdf-cover-body.is-center {
  width: 200mm;
  white-space: normal;
}
.pdf-cover-footer,
.pdf-cover-copyright { color: #666666; line-height: 1.35; }
.note-shell.cover-following { break-before: page; }
.pdf-cover.has-watermark,
.note-shell.has-background {
  background-repeat: repeat;
  background-position: center center;
}
@page cover { size: A4; margin: 0; }
@page { size: A4; margin: 18mm 17mm 24mm; }
@media print {
  .note-shell { max-width: none; padding: 0; }
  .note-content a { color: #1b1b1b; }
}
@media screen {
  body { background: #f3f3f3; }
  .note-shell { min-height: 100vh; background: #ffffff; }
}
`

const noteExportDocument = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; media-src data: https: http:; style-src 'unsafe-inline'; font-src data:">
  <title>{{.Title}}</title>
  <style>{{.CSS}}</style>
</head>
<body>
  {{if .PDFCoverHTML}}<section class="pdf-cover{{if .PDFCoverWatermarkStyle}} has-watermark{{end}}" style="{{.PDFCoverWatermarkStyle}}" aria-label="文件封面">{{.PDFCoverHTML}}</section>{{end}}
  <main class="note-shell{{if .PDFCoverHTML}} cover-following{{end}}{{if .PDFBodyBackgroundStyle}} has-background{{end}}" style="{{.PDFBodyBackgroundStyle}}">
    <div class="note-kicker">{{.Notebook}} · {{.Updated}}</div>
    <h1 class="note-title">{{.Title}}</h1>
    <article class="note-content">{{.Content}}</article>
  </main>
</body>
</html>`

type noteExportDocumentData struct {
	Title                  string
	Notebook               string
	Updated                string
	CSS                    template.CSS
	Content                template.HTML
	PDFWatermarkStyle      template.CSS
	PDFBodyBackgroundStyle template.CSS
	PDFCoverWatermarkStyle template.CSS
	PDFCoverHTML           template.HTML
}

func buildNoteExportHTML(
	ctx context.Context,
	store *Store,
	note Note,
	htmlContent string,
	pdfDecorations ...pdfExportDecorations,
) (string, error) {
	notebook, err := store.getNotebook(ctx, note.NotebookID)
	if err != nil {
		return "", errors.New("筆記本不存在")
	}
	sanitized := sanitizeExportHTML(htmlContent)
	embedded, err := embedExportResources(ctx, store, sanitized)
	if err != nil {
		return "", err
	}
	pageTemplate, err := template.New("note-export").Parse(noteExportDocument)
	if err != nil {
		return "", err
	}
	var output bytes.Buffer
	data := noteExportDocumentData{
		Title:    strings.TrimSpace(note.Title),
		Notebook: strings.TrimSpace(notebook.Title),
		Updated:  time.UnixMilli(note.UpdatedAt).In(time.Local).Format("2006-01-02 15:04"),
		CSS:      template.CSS(noteExportCSS),
		Content:  template.HTML(embedded),
	}
	if len(pdfDecorations) > 0 {
		data.PDFWatermarkStyle = pdfDecorations[0].WatermarkStyle
		data.PDFBodyBackgroundStyle = pdfDecorations[0].BodyBackgroundStyle
		data.PDFCoverHTML = pdfDecorations[0].CoverHTML
		if pdfDecorations[0].CoverWatermark {
			data.PDFCoverWatermarkStyle = pdfDecorations[0].WatermarkStyle
		}
	}
	if data.Title == "" {
		data.Title = "未命名筆記"
	}
	if err := pageTemplate.Execute(&output, data); err != nil {
		return "", err
	}
	return output.String(), nil
}

func sanitizeExportHTML(value string) string {
	policy := bluemonday.UGCPolicy()
	policy.AllowAttrs("class").Globally()
	policy.AllowAttrs("id").Globally()
	policy.AllowAttrs("data-lang", "data-render", "data-type").OnElements("code", "pre", "span", "div")
	policy.AllowAttrs("type", "checked", "disabled").OnElements("input")
	policy.AllowAttrs("align", "colspan", "rowspan").OnElements("td", "th")
	policy.AllowAttrs("start").OnElements("ol")
	policy.AllowURLSchemes("http", "https", "mailto")
	policy.AllowURLSchemeWithCustomPolicy("data", func(value *url.URL) bool {
		return strings.HasPrefix(
			strings.ToLower(value.String()),
			"data:image/png;base64,",
		)
	})
	return policy.Sanitize(value)
}

func embedExportResources(ctx context.Context, store *Store, value string) (string, error) {
	contextNode := &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div}
	nodes, err := html.ParseFragment(strings.NewReader(value), contextNode)
	if err != nil {
		return "", fmt.Errorf("解析筆記內容失敗: %w", err)
	}
	cache := map[string]string{}
	for _, node := range nodes {
		if err := embedResourceNodes(ctx, store, node, cache); err != nil {
			return "", err
		}
	}
	var output strings.Builder
	for _, node := range nodes {
		if err := html.Render(&output, node); err != nil {
			return "", err
		}
	}
	return output.String(), nil
}

func embedResourceNodes(ctx context.Context, store *Store, node *html.Node, cache map[string]string) error {
	if node.Type == html.ElementNode {
		for index := range node.Attr {
			key := strings.ToLower(node.Attr[index].Key)
			if key != "src" && key != "href" && key != "poster" {
				continue
			}
			resourceID, ok := exportResourceID(node.Attr[index].Val)
			if !ok {
				continue
			}
			dataURL, exists := cache[resourceID]
			if !exists {
				resource, err := store.Resource(ctx, resourceID)
				if err != nil {
					return fmt.Errorf("找不到筆記附件 %s", resourceID)
				}
				data, err := os.ReadFile(store.resourcePath(resourceID))
				if err != nil {
					return fmt.Errorf("無法讀取附件 %s: %w", resource.Filename, err)
				}
				mimeType := resource.Mime
				if mimeType == "" {
					mimeType = detectMimeData(resource.Filename, data)
				}
				dataURL = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data)
				cache[resourceID] = dataURL
				if key == "href" && !strings.HasPrefix(mimeType, "image/") {
					appendHTMLElementAttribute(node, "download", resource.Filename)
				}
			}
			node.Attr[index].Val = dataURL
		}
	}
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if err := embedResourceNodes(ctx, store, child, cache); err != nil {
			return err
		}
	}
	return nil
}

func appendHTMLElementAttribute(node *html.Node, key string, value string) {
	for _, attribute := range node.Attr {
		if strings.EqualFold(attribute.Key, key) {
			return
		}
	}
	node.Attr = append(node.Attr, html.Attribute{Key: key, Val: value})
}

func exportResourceID(value string) (string, bool) {
	value = strings.TrimSpace(value)
	switch {
	case strings.HasPrefix(value, ":/"):
		value = strings.TrimPrefix(value, ":/")
	case strings.HasPrefix(value, "/resources/"):
		value = strings.TrimPrefix(value, "/resources/")
	default:
		return "", false
	}
	if len(value) != 32 {
		return "", false
	}
	for _, character := range value {
		if !((character >= 'a' && character <= 'z') ||
			(character >= 'A' && character <= 'Z') ||
			(character >= '0' && character <= '9')) {
			return "", false
		}
	}
	return value, true
}

func renderNotePDF(
	ctx context.Context,
	htmlDocument string,
	destination string,
	browserPath string,
	footerCopyright ...string,
) error {
	tempDir, err := os.MkdirTemp("", "puffjoplin-pdf-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDir)

	htmlPath := filepath.Join(tempDir, "note.html")
	if err := os.WriteFile(htmlPath, []byte(htmlDocument), 0o600); err != nil {
		return err
	}
	documentPath := filepath.ToSlash(htmlPath)
	if filepath.VolumeName(htmlPath) != "" {
		documentPath = "/" + strings.TrimPrefix(documentPath, "/")
	}
	documentURL := (&url.URL{Scheme: "file", Path: documentPath}).String()

	options := append([]chromedp.ExecAllocatorOption{}, chromedp.DefaultExecAllocatorOptions[:]...)
	var browserOutput bytes.Buffer
	options = append(options,
		chromedp.ExecPath(browserPath),
		chromedp.UserDataDir(filepath.Join(tempDir, "profile")),
		chromedp.DisableGPU,
		chromedp.Flag("hide-scrollbars", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-setuid-sandbox", true),
		chromedp.CombinedOutput(&browserOutput),
	)
	allocatorContext, cancelAllocator := chromedp.NewExecAllocator(ctx, options...)
	defer cancelAllocator()
	browserContext, cancelBrowser := chromedp.NewContext(allocatorContext)
	defer cancelBrowser()
	printContext, cancelPrint := context.WithTimeout(browserContext, 45*time.Second)
	defer cancelPrint()

	if err := chromedp.Do(printContext, chromedp.Navigate(documentURL)); err != nil {
		if output := strings.TrimSpace(browserOutput.String()); output != "" {
			return fmt.Errorf(
				"無法啟動 PDF 瀏覽器 %s: %w\n%s",
				browserPath,
				err,
				output,
			)
		}
		return fmt.Errorf("無法載入 PDF 頁面: %w", err)
	}
	if err := chromedp.Do(printContext, chromedp.WaitReady(chromedp.CSS("body"))); err != nil {
		return fmt.Errorf("PDF 頁面尚未就緒: %w", err)
	}
	if _, err := chromedp.Run(printContext, chromedp.Evaluate[bool](`
		(async () => {
			await Promise.all(Array.from(document.images).map((image) => {
				if (image.complete) return Promise.resolve();
				return new Promise((resolve) => {
					image.addEventListener("load", resolve, { once: true });
					image.addEventListener("error", resolve, { once: true });
					setTimeout(resolve, 5000);
				});
			}));
			if (document.fonts && document.fonts.ready) await document.fonts.ready;
			return true;
		})()
	`, chromedp.EvalAwaitPromise)); err != nil {
		return fmt.Errorf("等待 PDF 資源失敗: %w", err)
	}
	printOptions := []chromedp.PDFOption{
		chromedp.PDFPaper(chromedp.PaperA4),
		chromedp.PDFMargins(0, 0, 0, 0),
		chromedp.PDFPreferCSSPageSize(),
		chromedp.PDFPrintBackground(),
		chromedp.PDFOutlineAndTagged(),
		chromedp.PDFStream(),
	}
	if len(footerCopyright) > 0 && strings.TrimSpace(footerCopyright[0]) != "" {
		printOptions = append(
			printOptions,
			chromedp.PDFHeaderTemplate("<span></span>"),
			chromedp.PDFFooterTemplate(pdfFooterHTMLTemplate(footerCopyright[0])),
		)
	}
	pdfData, err := chromedp.Run(printContext, chromedp.PrintToPDF(printOptions...))
	if err != nil {
		return fmt.Errorf("產生 PDF 失敗: %w", err)
	}
	if len(pdfData) == 0 {
		return errors.New("PDF 引擎沒有產生內容")
	}
	return os.WriteFile(destination, pdfData, 0o644)
}

func renderNotePDFWithFallback(
	ctx context.Context,
	htmlDocument string,
	destination string,
	footerCopyright string,
) error {
	browsers, err := findPDFBrowserCandidates()
	if err != nil {
		return err
	}
	errorsByBrowser := make([]string, 0, len(browsers))
	for _, browserPath := range browsers {
		attemptContext, cancel := context.WithTimeout(ctx, 50*time.Second)
		renderErr := renderNotePDFWithCoverSplit(
			attemptContext,
			htmlDocument,
			destination,
			browserPath,
			footerCopyright,
		)
		cancel()
		if renderErr == nil {
			return nil
		}
		errorsByBrowser = append(
			errorsByBrowser,
			fmt.Sprintf("%s: %v", browserPath, renderErr),
		)
	}
	return errors.New("所有 PDF 瀏覽器都無法啟動:\n" + strings.Join(errorsByBrowser, "\n"))
}

func renderNotePDFWithCoverSplit(
	ctx context.Context,
	htmlDocument string,
	destination string,
	browserPath string,
	footerCopyright string,
) error {
	if !strings.Contains(htmlDocument, `class="pdf-cover`) ||
		strings.TrimSpace(footerCopyright) == "" {
		return renderNotePDF(ctx, htmlDocument, destination, browserPath, footerCopyright)
	}

	tempDir, err := os.MkdirTemp("", "puffjoplin-pdf-parts-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDir)
	coverPath := filepath.Join(tempDir, "cover.pdf")
	bodyPath := filepath.Join(tempDir, "body.pdf")
	if err := renderNotePDF(
		ctx,
		injectNotePrintVariant(htmlDocument, true),
		coverPath,
		browserPath,
	); err != nil {
		return fmt.Errorf("產生封面 PDF 失敗: %w", err)
	}
	if err := renderNotePDF(
		ctx,
		injectNotePrintVariant(htmlDocument, false),
		bodyPath,
		browserPath,
		footerCopyright,
	); err != nil {
		return fmt.Errorf("產生內文 PDF 失敗: %w", err)
	}
	return mergePDFFiles(ctx, destination, coverPath, bodyPath)
}

func injectNotePrintVariant(htmlDocument string, coverOnly bool) string {
	css := `<style>@media print{.pdf-cover{display:none!important}.note-shell.cover-following{break-before:auto!important}}</style>`
	if coverOnly {
		css = `<style>@media print{.note-shell{display:none!important}}</style>`
	}
	return strings.Replace(htmlDocument, "</head>", css+"</head>", 1)
}

func mergePDFFiles(ctx context.Context, destination string, paths ...string) error {
	readers := make([]io.ReadSeeker, 0, len(paths))
	files := make([]*os.File, 0, len(paths))
	defer func() {
		for _, file := range files {
			_ = file.Close()
		}
	}()
	for _, path := range paths {
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		files = append(files, file)
		readers = append(readers, file)
	}
	var merged bytes.Buffer
	if err := api.MergeRaw(
		ctx,
		readers,
		&merged,
		false,
		model.NewDefaultConfiguration(),
	); err != nil {
		return fmt.Errorf("合併 PDF 頁面失敗: %w", err)
	}
	return os.WriteFile(destination, merged.Bytes(), 0o644)
}

func findPDFBrowser() (string, error) {
	browsers, err := findPDFBrowserCandidates()
	if err != nil {
		return "", err
	}
	return browsers[0], nil
}

func findPDFBrowserCandidates() ([]string, error) {
	candidates := make([]string, 0, 6)
	seen := make(map[string]bool)
	addCandidate := func(path string) {
		path = strings.TrimSpace(path)
		if path == "" || seen[strings.ToLower(path)] {
			return
		}
		if info, err := os.Stat(path); err != nil || info.IsDir() {
			return
		}
		seen[strings.ToLower(path)] = true
		candidates = append(candidates, path)
	}
	if configured := strings.TrimSpace(os.Getenv("PUFFJOPLIN_PDF_BROWSER")); configured != "" {
		addCandidate(configured)
	}
	for _, name := range []string{"chrome", "chrome.exe", "msedge", "msedge.exe", "chromium", "chromium-browser"} {
		if path, err := exec.LookPath(name); err == nil {
			addCandidate(path)
		}
	}
	for _, candidate := range []string{
		filepath.Join(os.Getenv("ProgramFiles"), "Google", "Chrome", "Application", "chrome.exe"),
		filepath.Join(os.Getenv("ProgramFiles(x86)"), "Google", "Chrome", "Application", "chrome.exe"),
		filepath.Join(os.Getenv("ProgramFiles(x86)"), "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(os.Getenv("ProgramFiles"), "Microsoft", "Edge", "Application", "msedge.exe"),
	} {
		addCandidate(candidate)
	}
	if len(candidates) > 0 {
		return candidates, nil
	}
	return nil, errors.New("找不到 Microsoft Edge 或 Chrome，無法產生 PDF")
}
