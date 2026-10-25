package main

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
)

func TestSaveMermaidImagesWritesValidatedFiles(t *testing.T) {
	directory := t.TempDir()
	svg := `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>`
	png := "\x89PNG\r\n\x1a\nimage"
	paths, err := saveMermaidImages(directory, "svg", "流程圖", []string{
		base64.StdEncoding.EncodeToString([]byte(svg)),
		base64.StdEncoding.EncodeToString([]byte(svg)),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(paths) != 2 {
		t.Fatalf("expected two exports, got %d", len(paths))
	}
	for index, path := range paths {
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("export %d was not written: %v", index+1, err)
		}
	}

	pngPaths, err := saveMermaidImages(directory, "png", "流程圖", []string{
		base64.StdEncoding.EncodeToString([]byte(png)),
	})
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Ext(pngPaths[0]) != ".png" {
		t.Fatalf("unexpected PNG path: %s", pngPaths[0])
	}
}

func TestSaveMermaidImagesRejectsInvalidData(t *testing.T) {
	directory := t.TempDir()
	if _, err := saveMermaidImages(directory, "svg", "diagram", []string{
		base64.StdEncoding.EncodeToString([]byte("not svg")),
	}); err == nil {
		t.Fatal("invalid SVG was accepted")
	}
	if _, err := saveMermaidImages(directory, "png", "diagram", []string{
		base64.StdEncoding.EncodeToString([]byte("not png")),
	}); err == nil {
		t.Fatal("invalid PNG was accepted")
	}
	if _, err := saveMermaidImages(directory, "svg", "diagram", nil); err == nil {
		t.Fatal("empty export was accepted")
	}
}
