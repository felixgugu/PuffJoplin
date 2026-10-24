//go:build windows

package main

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"

	"golang.org/x/image/bmp"
)

func TestDIBToPNG(t *testing.T) {
	source := image.NewRGBA(image.Rect(0, 0, 2, 2))
	source.Set(0, 0, color.RGBA{R: 255, A: 255})
	source.Set(1, 0, color.RGBA{G: 255, A: 255})
	source.Set(0, 1, color.RGBA{B: 255, A: 255})
	source.Set(1, 1, color.White)
	var encoded bytes.Buffer
	if err := bmp.Encode(&encoded, source); err != nil {
		t.Fatal(err)
	}
	dib := encoded.Bytes()[14:]
	data, err := dibToPNG(dib)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if decoded.Bounds().Dx() != 2 || decoded.Bounds().Dy() != 2 {
		t.Fatalf("unexpected decoded bounds: %v", decoded.Bounds())
	}
}

func TestBitmapBGRAtoPNG(t *testing.T) {
	pixels := []byte{
		0, 0, 255, 255, // bottom-left red (BGRA)
		0, 255, 0, 255, // bottom-right green
		255, 0, 0, 255, // top-left blue
		255, 255, 255, 255, // top-right white
	}
	data, err := bitmapBGRAtoPNG(pixels, 2, 2)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if r, g, b, _ := decoded.At(0, 0).RGBA(); r>>8 != 0 || g>>8 != 0 || b>>8 != 255 {
		t.Fatalf("unexpected top-left pixel: %d %d %d", r>>8, g>>8, b>>8)
	}
	if r, g, b, _ := decoded.At(0, 1).RGBA(); r>>8 != 255 || g>>8 != 0 || b>>8 != 0 {
		t.Fatalf("unexpected bottom-left pixel: %d %d %d", r>>8, g>>8, b>>8)
	}
	if r, g, b, _ := decoded.At(1, 1).RGBA(); r>>8 != 0 || g>>8 != 255 || b>>8 != 0 {
		t.Fatalf("unexpected bottom-right pixel: %d %d %d", r>>8, g>>8, b>>8)
	}
}
