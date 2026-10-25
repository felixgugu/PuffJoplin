package main

import (
	"bytes"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

func (a *App) CopyClipboardImage(filename string, dataBase64 string) error {
	data, err := decodeClipboardImageData(dataBase64)
	if err != nil {
		return err
	}
	_ = filename
	return writeClipboardImagePNG(data)
}

func (a *App) CopyClipboardFile(filename string, dataBase64 string) error {
	data, err := base64.StdEncoding.DecodeString(strings.TrimSpace(dataBase64))
	if err != nil {
		return errors.New("剪貼簿檔案內容格式無效")
	}
	if !supportedImageFilename(filename) {
		return errors.New("剪貼簿檔案不是支援的圖片格式")
	}
	if !validImageFileData(filename, data) {
		return errors.New("剪貼簿圖片內容與副檔名不符")
	}
	path, err := prepareClipboardFile(filename, data)
	if err != nil {
		return err
	}
	return writeClipboardImageFile(path)
}

func (a *App) CopyResourceFileToClipboard(resourceID string) error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	resource, err := store.Resource(a.ctx, strings.TrimSpace(resourceID))
	if err != nil {
		return errors.New("圖片附件不存在")
	}
	if !strings.HasPrefix(strings.ToLower(resource.Mime), "image/") ||
		!supportedImageFilename(resource.Filename) {
		return errors.New("附件不是支援的圖片格式")
	}
	data, err := os.ReadFile(store.storedResourcePath(resource))
	if err != nil {
		return err
	}
	path, err := prepareClipboardFile(filepath.Base(resource.Filename), data)
	if err != nil {
		return err
	}
	return writeClipboardImageFile(path)
}

func decodeClipboardImageData(dataBase64 string) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(strings.TrimSpace(dataBase64))
	if err != nil {
		return nil, errors.New("剪貼簿圖片內容格式無效")
	}
	if len(data) == 0 || len(data) > maxUploadFileBytes {
		return nil, errors.New("剪貼簿圖片大小無效")
	}
	if len(data) < 8 || string(data[:8]) != "\x89PNG\r\n\x1a\n" {
		return nil, errors.New("剪貼簿圖片必須是 PNG")
	}
	return data, nil
}

func supportedImageFilename(filename string) bool {
	switch strings.ToLower(filepath.Ext(strings.TrimSpace(filename))) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg":
		return true
	default:
		return false
	}
}

func validImageFileData(filename string, data []byte) bool {
	switch strings.ToLower(filepath.Ext(strings.TrimSpace(filename))) {
	case ".png":
		return bytes.HasPrefix(data, []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})
	case ".jpg", ".jpeg":
		return len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff
	case ".gif":
		return bytes.HasPrefix(data, []byte("GIF8"))
	case ".webp":
		return len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP"
	case ".bmp":
		return bytes.HasPrefix(data, []byte("BM"))
	case ".svg":
		header := data
		if len(header) > 4096 {
			header = header[:4096]
		}
		return bytes.Contains(bytes.ToLower(header), []byte("<svg"))
	default:
		return false
	}
}
