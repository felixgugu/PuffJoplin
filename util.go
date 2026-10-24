package main

import (
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func copyFile(source string, dest string) error {
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

func detectMime(path string) string {
	ext := filepath.Ext(path)
	if value := mime.TypeByExtension(ext); value != "" {
		return value
	}
	file, err := os.Open(path)
	if err != nil {
		return "application/octet-stream"
	}
	defer file.Close()
	buffer := make([]byte, 512)
	count, _ := file.Read(buffer)
	return http.DetectContentType(buffer[:count])
}

func detectMimeData(filename string, data []byte) string {
	if value := mime.TypeByExtension(filepath.Ext(filename)); value != "" {
		return value
	}
	if len(data) == 0 {
		return "application/octet-stream"
	}
	return http.DetectContentType(data)
}

func normalizeResourceFilename(filename string, title string, mimeType string, extension string) string {
	name := strings.TrimSpace(strings.ReplaceAll(filename, `\`, "/"))
	if name != "" {
		name = filepath.Base(name)
	}
	if name == "" || name == "." {
		name = strings.TrimSpace(strings.ReplaceAll(title, `\`, "/"))
		if name != "" {
			name = filepath.Base(name)
		}
	}
	name = safeFilename(name)
	if name == "" {
		name = "attachment"
	}
	if filepath.Ext(name) == "" {
		extension = strings.TrimPrefix(strings.TrimSpace(extension), ".")
		if extension == "" {
			extension = preferredMimeExtension(mimeType)
		}
		if extension != "" {
			name += "." + safeFilename(extension)
		}
	}
	return name
}

func preferredMimeExtension(mimeType string) string {
	switch strings.ToLower(strings.TrimSpace(strings.Split(mimeType, ";")[0])) {
	case "image/png":
		return "png"
	case "image/jpeg":
		return "jpg"
	case "image/gif":
		return "gif"
	case "image/webp":
		return "webp"
	case "image/svg+xml":
		return "svg"
	case "application/pdf":
		return "pdf"
	case "text/plain":
		return "txt"
	}
	extensions, err := mime.ExtensionsByType(mimeType)
	if err != nil || len(extensions) == 0 {
		return ""
	}
	sort.Strings(extensions)
	return strings.TrimPrefix(extensions[0], ".")
}

func safeToOpenResource(filename string) bool {
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif",
		".pdf", ".txt", ".md", ".markdown", ".json", ".csv", ".xml", ".html",
		".mp3", ".wav", ".m4a", ".ogg", ".mp4", ".webm", ".mov",
		".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods":
		return true
	default:
		return false
	}
}
