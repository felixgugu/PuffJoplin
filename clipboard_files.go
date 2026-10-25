package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const clipboardTempMaxAge = 7 * 24 * time.Hour

func clipboardTempDirectory() string {
	return filepath.Join(os.TempDir(), "PuffJoplin", "clipboard")
}

func prepareClipboardFile(filename string, data []byte) (string, error) {
	if len(data) == 0 || len(data) > maxUploadFileBytes {
		return "", errors.New("剪貼簿檔案大小無效")
	}
	name := safeFilename(filepath.Base(strings.ReplaceAll(filename, `\`, "/")))
	if name == "" {
		name = "PuffJoplin-image"
	}
	directory := clipboardTempDirectory()
	if err := os.MkdirAll(directory, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(directory, name)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	return path, nil
}

func cleanupClipboardTempFiles() error {
	directory := clipboardTempDirectory()
	entries, err := os.ReadDir(directory)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	cutoff := time.Now().Add(-clipboardTempMaxAge)
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil || info.ModTime().After(cutoff) {
			continue
		}
		_ = os.Remove(filepath.Join(directory, entry.Name()))
	}
	return nil
}
