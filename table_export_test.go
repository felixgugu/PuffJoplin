package main

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
)

func TestDecodeXlsxExportValidatesPackage(t *testing.T) {
	if _, err := decodeXlsxExport("not-base64"); err == nil {
		t.Fatal("invalid base64 was accepted")
	}
	if _, err := decodeXlsxExport(base64.StdEncoding.EncodeToString([]byte("nope"))); err == nil {
		t.Fatal("non-zip payload was accepted")
	}
	data := []byte("PK\x03\x04xlsx-package")
	decoded, err := decodeXlsxExport(base64.StdEncoding.EncodeToString(data))
	if err != nil {
		t.Fatal(err)
	}
	if string(decoded) != string(data) {
		t.Fatalf("unexpected decoded bytes: %q", decoded)
	}
}

func TestOpenFilePathRejectsUnsafePaths(t *testing.T) {
	app := &App{}
	for _, path := range []string{"", "relative.xlsx", filepath.Join(t.TempDir(), "missing.xlsx")} {
		if err := app.OpenFilePath(path); err == nil {
			t.Fatalf("unsafe path was accepted: %q", path)
		}
	}
	textPath := filepath.Join(t.TempDir(), "note.txt")
	if err := os.WriteFile(textPath, []byte("text"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := app.OpenFilePath(textPath); err == nil {
		t.Fatal("non-xlsx file was accepted")
	}
}
