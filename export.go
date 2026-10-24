package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"html/template"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/microcosm-cc/bluemonday"
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
@page { size: A4; margin: 18mm 17mm; }
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
  <main class="note-shell">
    <div class="note-kicker">{{.Notebook}} · {{.Updated}}</div>
    <h1 class="note-title">{{.Title}}</h1>
    <article class="note-content">{{.Content}}</article>
  </main>
</body>
</html>`

type noteExportDocumentData struct {
	Title    string
	Notebook string
	Updated  string
	CSS      template.CSS
	Content  template.HTML
}

func buildNoteExportHTML(ctx context.Context, store *Store, note Note, htmlContent string) (string, error) {
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

func renderNotePDF(ctx context.Context, htmlDocument string, destination string, browserPath string) error {
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
	options = append(options,
		chromedp.ExecPath(browserPath),
		chromedp.UserDataDir(filepath.Join(tempDir, "profile")),
		chromedp.DisableGPU,
		chromedp.Flag("hide-scrollbars", true),
	)
	allocatorContext, cancelAllocator := chromedp.NewExecAllocator(ctx, options...)
	defer cancelAllocator()
	browserContext, cancelBrowser := chromedp.NewContext(allocatorContext)
	defer cancelBrowser()
	printContext, cancelPrint := context.WithTimeout(browserContext, 45*time.Second)
	defer cancelPrint()

	if err := chromedp.Do(printContext, chromedp.Navigate(documentURL)); err != nil {
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
	pdfData, err := chromedp.Run(printContext, chromedp.PrintToPDF(
		chromedp.PDFPaper(chromedp.PaperA4),
		chromedp.PDFMargins(0, 0, 0, 0),
		chromedp.PDFPreferCSSPageSize(),
		chromedp.PDFPrintBackground(),
		chromedp.PDFOutlineAndTagged(),
		chromedp.PDFStream(),
	))
	if err != nil {
		return fmt.Errorf("產生 PDF 失敗: %w", err)
	}
	if len(pdfData) == 0 {
		return errors.New("PDF 引擎沒有產生內容")
	}
	return os.WriteFile(destination, pdfData, 0o644)
}

func findPDFBrowser() (string, error) {
	if configured := strings.TrimSpace(os.Getenv("PUFFJOPLIN_PDF_BROWSER")); configured != "" {
		if _, err := os.Stat(configured); err == nil {
			return configured, nil
		}
	}
	for _, name := range []string{"msedge", "msedge.exe", "chrome", "chrome.exe", "chromium", "chromium-browser"} {
		if path, err := exec.LookPath(name); err == nil {
			return path, nil
		}
	}
	candidates := []string{
		filepath.Join(os.Getenv("ProgramFiles(x86)"), "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(os.Getenv("ProgramFiles"), "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(os.Getenv("ProgramFiles"), "Google", "Chrome", "Application", "chrome.exe"),
		filepath.Join(os.Getenv("ProgramFiles(x86)"), "Google", "Chrome", "Application", "chrome.exe"),
	}
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
	}
	return "", errors.New("找不到 Microsoft Edge 或 Chrome，無法產生 PDF")
}
