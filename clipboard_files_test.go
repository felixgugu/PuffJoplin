package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestPrepareClipboardFileUsesSafeFilename(t *testing.T) {
	tempRoot := t.TempDir()
	t.Setenv("TEMP", tempRoot)
	t.Setenv("TMP", tempRoot)
	path, err := prepareClipboardFile(`..\bad:name.png`, []byte("image"))
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Dir(path) != clipboardTempDirectory() {
		t.Fatalf("unexpected clipboard directory: %s", path)
	}
	if filepath.Base(path) != "bad-name.png" {
		t.Fatalf("unexpected clipboard filename: %s", filepath.Base(path))
	}
}

func TestCleanupClipboardTempFilesRemovesExpiredEntries(t *testing.T) {
	tempRoot := t.TempDir()
	t.Setenv("TEMP", tempRoot)
	t.Setenv("TMP", tempRoot)
	directory := clipboardTempDirectory()
	if err := os.MkdirAll(directory, 0o755); err != nil {
		t.Fatal(err)
	}
	oldPath := filepath.Join(directory, "old.png")
	newPath := filepath.Join(directory, "new.png")
	if err := os.WriteFile(oldPath, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(newPath, []byte("new"), 0o644); err != nil {
		t.Fatal(err)
	}
	oldTime := time.Now().Add(-8 * 24 * time.Hour)
	if err := os.Chtimes(oldPath, oldTime, oldTime); err != nil {
		t.Fatal(err)
	}
	if err := cleanupClipboardTempFiles(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Fatalf("expired clipboard file still exists: %v", err)
	}
	if _, err := os.Stat(newPath); err != nil {
		t.Fatalf("recent clipboard file was removed: %v", err)
	}
}

func TestSupportedImageFilename(t *testing.T) {
	for _, name := range []string{"a.png", "a.JPG", "a.jpeg", "a.gif", "a.webp", "a.bmp", "a.svg"} {
		if !supportedImageFilename(name) {
			t.Fatalf("%s should be supported", name)
		}
	}
	for _, name := range []string{"a.txt", "a.pdf", "no-extension"} {
		if supportedImageFilename(name) {
			t.Fatalf("%s should not be supported", name)
		}
	}
}

func TestValidImageFileData(t *testing.T) {
	tests := []struct {
		filename string
		data     []byte
		valid    bool
	}{
		{"a.png", []byte("\x89PNG\r\n\x1a\nrest"), true},
		{"a.jpg", []byte{0xff, 0xd8, 0xff, 0xe0}, true},
		{"a.gif", []byte("GIF89a"), true},
		{"a.webp", []byte("RIFF1234WEBP"), true},
		{"a.bmp", []byte("BMpixels"), true},
		{"a.svg", []byte(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>`), true},
		{"a.png", []byte("not png"), false},
		{"a.svg", []byte("not svg"), false},
	}
	for _, test := range tests {
		if actual := validImageFileData(test.filename, test.data); actual != test.valid {
			t.Errorf("validImageFileData(%q) = %v, want %v", test.filename, actual, test.valid)
		}
	}
}
