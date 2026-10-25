package main

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	maxMermaidExportFiles = 100
	maxMermaidExportBytes = 64 << 20
)

var pngExportSignature = []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}

func (a *App) ExportMermaidImages(noteID string, format string, images []string) (string, error) {
	store, err := a.readyStore()
	if err != nil {
		return "", err
	}
	note, err := store.GetNote(a.ctx, strings.TrimSpace(noteID))
	if err != nil {
		return "", errors.New("筆記不存在")
	}
	format = strings.ToLower(strings.TrimSpace(format))
	if format != "svg" && format != "png" {
		return "", errors.New("不支援的 Mermaid 匯出格式")
	}
	if len(images) == 0 {
		return "", errors.New("筆記中沒有 Mermaid 圖表")
	}
	directory, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                "匯出 Mermaid " + strings.ToUpper(format),
		CanCreateDirectories: true,
	})
	if err != nil || directory == "" {
		return directory, err
	}
	if _, err := saveMermaidImages(directory, format, note.Title, images); err != nil {
		return "", err
	}
	return directory, nil
}

func saveMermaidImages(directory string, format string, title string, images []string) ([]string, error) {
	directory, err := filepath.Abs(strings.TrimSpace(directory))
	if err != nil {
		return nil, err
	}
	info, err := os.Stat(directory)
	if err != nil || !info.IsDir() {
		return nil, errors.New("Mermaid 匯出目錄無效")
	}
	format = strings.ToLower(strings.TrimSpace(format))
	extension := "." + format
	if format != "svg" && format != "png" {
		return nil, errors.New("不支援的 Mermaid 匯出格式")
	}
	if len(images) == 0 {
		return nil, errors.New("筆記中沒有 Mermaid 圖表")
	}
	if len(images) > maxMermaidExportFiles {
		return nil, fmt.Errorf("Mermaid 圖表超過 %d 張", maxMermaidExportFiles)
	}
	base := safeExportName(title, "PuffJoplin-diagram")
	usedNames := make(map[string]map[string]bool)
	paths := make([]string, 0, len(images))
	for index, encoded := range images {
		data, err := base64.StdEncoding.DecodeString(strings.TrimSpace(encoded))
		if err != nil {
			return nil, fmt.Errorf("第 %d 張 Mermaid 圖片格式無效", index+1)
		}
		if len(data) == 0 || len(data) > maxMermaidExportBytes {
			return nil, fmt.Errorf("第 %d 張 Mermaid 圖片大小無效", index+1)
		}
		if !validMermaidExportData(data, format) {
			return nil, fmt.Errorf("第 %d 張 Mermaid %s 內容無效", index+1, strings.ToUpper(format))
		}
		stem := base
		if len(images) > 1 {
			stem = fmt.Sprintf("%s-%02d", base, index+1)
		}
		filename := uniqueExportFilename(directory, stem, extension, usedNames)
		path := filepath.Join(directory, filename)
		if err := os.WriteFile(path, data, 0o644); err != nil {
			return nil, fmt.Errorf("無法寫入 Mermaid 圖片 %s: %w", filename, err)
		}
		paths = append(paths, path)
	}
	return paths, nil
}

func validMermaidExportData(data []byte, format string) bool {
	if format == "png" {
		return bytes.HasPrefix(data, pngExportSignature)
	}
	if format != "svg" {
		return false
	}
	header := data
	if len(header) > 4096 {
		header = header[:4096]
	}
	return bytes.Contains(bytes.ToLower(header), []byte("<svg"))
}
