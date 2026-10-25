//go:build windows

package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"testing"
	"unicode/utf16"

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

func TestImageDataToDIBFlattensTransparentPixels(t *testing.T) {
	source := image.NewNRGBA(image.Rect(0, 0, 2, 1))
	source.SetNRGBA(0, 0, color.NRGBA{R: 255, A: 255})
	source.SetNRGBA(1, 0, color.NRGBA{A: 0})
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, source); err != nil {
		t.Fatal(err)
	}
	dib, err := imageDataToDIB(encoded.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if len(dib) != 40+8 {
		t.Fatalf("unexpected DIB length: %d", len(dib))
	}
	if width := int(int32(binary.LittleEndian.Uint32(dib[4:8]))); width != 2 {
		t.Fatalf("unexpected DIB width: %d", width)
	}
	if bitCount := binary.LittleEndian.Uint16(dib[14:16]); bitCount != 24 {
		t.Fatalf("unexpected DIB bit count: %d", bitCount)
	}
	if pixels := dib[40:]; pixels[0] != 0 || pixels[1] != 0 || pixels[2] != 255 {
		t.Fatalf("red pixel was not encoded as BGR: %v", pixels[:3])
	}
	if pixels := dib[43:]; pixels[0] != 255 || pixels[1] != 255 || pixels[2] != 255 {
		t.Fatalf("transparent pixel was not flattened onto white: %v", pixels[:3])
	}
}

func TestClipboardUnicodeTextBytes(t *testing.T) {
	data := clipboardUnicodeTextBytes("A中")
	words := make([]uint16, 0, 3)
	for index := 0; index+1 < len(data); index += 2 {
		words = append(words, binary.LittleEndian.Uint16(data[index:index+2]))
	}
	if string(utf16.Decode(words[:2])) != "A中" || words[2] != 0 {
		t.Fatalf("unexpected UTF-16 clipboard data: %v", words)
	}
}
