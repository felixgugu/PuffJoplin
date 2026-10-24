//go:build windows

package main

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
	"unicode/utf16"
	"unsafe"

	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/webp"
	"golang.org/x/sys/windows"
)

const (
	cfBitmap = 2
	cfDIB    = 8
	cfDIBV5  = 17
	cfHDROP  = 15
)

var (
	user32                = windows.NewLazySystemDLL("user32.dll")
	kernel32              = windows.NewLazySystemDLL("kernel32.dll")
	gdi32                 = windows.NewLazySystemDLL("gdi32.dll")
	procOpenClipboard     = user32.NewProc("OpenClipboard")
	procCloseClipboard    = user32.NewProc("CloseClipboard")
	procGetClipboardData  = user32.NewProc("GetClipboardData")
	procRegisterClipboard = user32.NewProc("RegisterClipboardFormatW")
	procGlobalLock        = kernel32.NewProc("GlobalLock")
	procGlobalUnlock      = kernel32.NewProc("GlobalUnlock")
	procGlobalSize        = kernel32.NewProc("GlobalSize")
	procRtlMoveMemory     = kernel32.NewProc("RtlMoveMemory")
	procGetObject         = gdi32.NewProc("GetObjectW")
	procCreateCompatDC    = gdi32.NewProc("CreateCompatibleDC")
	procDeleteDC          = gdi32.NewProc("DeleteDC")
	procSelectObject      = gdi32.NewProc("SelectObject")
	procGetDIBits         = gdi32.NewProc("GetDIBits")
)

const (
	dibRGBColors = 0
	biRGB        = 0
)

type winBitmap struct {
	Type       int32
	Width      int32
	Height     int32
	WidthBytes int32
	Planes     uint16
	BitCount   uint16
	Bits       uintptr
}

type bitmapInfoHeader struct {
	Size          uint32
	Width         int32
	Height        int32
	Planes        uint16
	BitCount      uint16
	Compression   uint32
	SizeImage     uint32
	XPelsPerMeter int32
	YPelsPerMeter int32
	ClrUsed       uint32
	ClrImportant  uint32
}

type bitmapInfo struct {
	Header bitmapInfoHeader
	Colors [1]uint32
}

type clipboardImageData struct {
	filename string
	mime     string
	data     []byte
}

func readClipboardImage() (clipboardImageData, error) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	var opened bool
	for attempt := 0; attempt < 8; attempt++ {
		result, _, _ := procOpenClipboard.Call(0)
		if result != 0 {
			opened = true
			break
		}
		time.Sleep(15 * time.Millisecond)
	}
	if !opened {
		return clipboardImageData{}, errors.New("無法讀取剪貼簿，請稍後再試")
	}
	defer procCloseClipboard.Call()

	if data, err := clipboardFormatBytes(uint32(registeredClipboardFormat("PNG"))); err == nil {
		if _, _, err := image.DecodeConfig(bytes.NewReader(data)); err == nil {
			return clipboardImageData{
				filename: clipboardFilename("png"),
				mime:     "image/png",
				data:     data,
			}, nil
		}
	}
	for _, format := range []uint32{cfDIB, cfDIBV5} {
		if dib, err := clipboardFormatBytes(format); err == nil {
			if data, err := dibToPNG(dib); err == nil {
				return clipboardImageData{
					filename: clipboardFilename("png"),
					mime:     "image/png",
					data:     data,
				}, nil
			}
		}
	}
	if data, err := clipboardBitmapPNG(); err == nil {
		return clipboardImageData{
			filename: clipboardFilename("png"),
			mime:     "image/png",
			data:     data,
		}, nil
	}
	if path, err := clipboardDroppedPath(); err == nil {
		if data, err := imageFileData(path); err == nil {
			return data, nil
		}
	}
	return clipboardImageData{}, errors.New("剪貼簿中沒有可讀取的圖片")
}

func registeredClipboardFormat(name string) uintptr {
	namePtr, err := windows.UTF16PtrFromString(name)
	if err != nil {
		return 0
	}
	value, _, _ := procRegisterClipboard.Call(uintptr(unsafe.Pointer(namePtr)))
	return value
}

func clipboardFormatBytes(format uint32) ([]byte, error) {
	handle, _, _ := procGetClipboardData.Call(uintptr(format))
	if handle == 0 {
		return nil, errors.New("剪貼簿格式不存在")
	}
	pointer, _, _ := procGlobalLock.Call(handle)
	if pointer == 0 {
		return nil, errors.New("無法鎖定剪貼簿資料")
	}
	defer procGlobalUnlock.Call(handle)
	size, _, _ := procGlobalSize.Call(handle)
	if size == 0 || size > maxUploadFileBytes {
		return nil, errors.New("剪貼簿圖片大小無效")
	}
	data := make([]byte, int(size))
	procRtlMoveMemory.Call(
		uintptr(unsafe.Pointer(&data[0])),
		pointer,
		size,
	)
	return data, nil
}

func clipboardBitmapPNG() ([]byte, error) {
	handle, _, _ := procGetClipboardData.Call(cfBitmap)
	if handle == 0 {
		return nil, errors.New("剪貼簿點陣圖不存在")
	}
	var bitmap winBitmap
	if result, _, _ := procGetObject.Call(handle, unsafe.Sizeof(bitmap), uintptr(unsafe.Pointer(&bitmap))); result == 0 {
		return nil, errors.New("無法讀取剪貼簿點陣圖")
	}
	width, height := int(bitmap.Width), int(bitmap.Height)
	if width <= 0 || height <= 0 || int64(width)*int64(height)*4 > maxUploadFileBytes {
		return nil, errors.New("剪貼簿點陣圖尺寸無效")
	}

	deviceContext, _, _ := procCreateCompatDC.Call(0)
	if deviceContext == 0 {
		return nil, errors.New("無法建立剪貼簿圖片裝置")
	}
	defer procDeleteDC.Call(deviceContext)
	previous, _, _ := procSelectObject.Call(deviceContext, handle)
	if previous == 0 {
		return nil, errors.New("無法選取剪貼簿點陣圖")
	}
	defer procSelectObject.Call(deviceContext, previous)

	info := bitmapInfo{
		Header: bitmapInfoHeader{
			Size:        uint32(unsafe.Sizeof(bitmapInfoHeader{})),
			Width:       int32(width),
			Height:      int32(height),
			Planes:      1,
			BitCount:    32,
			Compression: biRGB,
			SizeImage:   uint32(width * height * 4),
		},
	}
	pixels := make([]byte, width*height*4)
	result, _, _ := procGetDIBits.Call(
		deviceContext,
		handle,
		0,
		uintptr(height),
		uintptr(unsafe.Pointer(&pixels[0])),
		uintptr(unsafe.Pointer(&info)),
		dibRGBColors,
	)
	if result == 0 {
		return nil, errors.New("無法轉換剪貼簿點陣圖")
	}
	return bitmapBGRAtoPNG(pixels, width, height)
}

func bitmapBGRAtoPNG(pixels []byte, width int, height int) ([]byte, error) {
	if width <= 0 || height <= 0 || len(pixels) < width*height*4 {
		return nil, errors.New("剪貼簿點陣圖資料無效")
	}
	output := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		// GetDIBits returns bottom-up rows for positive-height DIBs.
		source := (height - 1 - y) * width * 4
		for x := 0; x < width; x++ {
			offset := source + x*4
			output.SetRGBA(x, y, color.RGBA{
				R: pixels[offset+2],
				G: pixels[offset+1],
				B: pixels[offset],
				A: 255,
			})
		}
	}
	var data bytes.Buffer
	if err := png.Encode(&data, output); err != nil {
		return nil, err
	}
	return data.Bytes(), nil
}

func dibToPNG(dib []byte) ([]byte, error) {
	if len(dib) < 40 {
		return nil, errors.New("DIB 資料不完整")
	}
	headerSize := int(binary.LittleEndian.Uint32(dib[:4]))
	if headerSize < 40 || headerSize > len(dib) {
		return nil, errors.New("DIB header 無效")
	}
	bitCount := int(binary.LittleEndian.Uint16(dib[14:16]))
	paletteEntries := 0
	if bitCount <= 8 {
		if headerSize >= 36 {
			paletteEntries = int(binary.LittleEndian.Uint32(dib[32:36]))
		}
		if paletteEntries == 0 {
			paletteEntries = 1 << bitCount
		}
	}
	offset := 14 + headerSize + paletteEntries*4
	fileSize := 14 + len(dib)
	var bmp bytes.Buffer
	bmp.Write([]byte{'B', 'M'})
	_ = binary.Write(&bmp, binary.LittleEndian, uint32(fileSize))
	_ = binary.Write(&bmp, binary.LittleEndian, uint16(0))
	_ = binary.Write(&bmp, binary.LittleEndian, uint16(0))
	_ = binary.Write(&bmp, binary.LittleEndian, uint32(offset))
	bmp.Write(dib)
	decoded, _, err := image.Decode(&bmp)
	if err != nil {
		return nil, fmt.Errorf("解碼剪貼簿圖片失敗: %w", err)
	}
	return encodeClipboardPNG(decoded)
}

func encodeClipboardPNG(source image.Image) ([]byte, error) {
	bounds := source.Bounds()
	output := image.NewRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
	draw.Draw(output, output.Bounds(), &image.Uniform{C: color.White}, image.Point{}, draw.Src)
	draw.Draw(output, output.Bounds(), source, bounds.Min, draw.Over)
	var data bytes.Buffer
	if err := png.Encode(&data, output); err != nil {
		return nil, err
	}
	return data.Bytes(), nil
}

func clipboardDroppedPath() (string, error) {
	data, err := clipboardFormatBytes(cfHDROP)
	if err != nil || len(data) < 20 {
		return "", errors.New("剪貼簿檔案清單不存在")
	}
	offset := int(binary.LittleEndian.Uint32(data[:4]))
	wide := binary.LittleEndian.Uint32(data[16:20]) != 0
	if offset < 0 || offset >= len(data) {
		return "", errors.New("剪貼簿檔案路徑無效")
	}
	if wide {
		words := make([]uint16, 0)
		for index := offset; index+1 < len(data); index += 2 {
			value := binary.LittleEndian.Uint16(data[index : index+2])
			if value == 0 {
				break
			}
			words = append(words, value)
		}
		return string(utf16.Decode(words)), nil
	}
	end := bytes.IndexByte(data[offset:], 0)
	if end < 0 {
		return "", errors.New("剪貼簿檔案路徑無效")
	}
	return string(data[offset : offset+end]), nil
}

func imageFileData(path string) (clipboardImageData, error) {
	extension := strings.ToLower(filepath.Ext(path))
	switch extension {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg":
	default:
		return clipboardImageData{}, errors.New("剪貼簿檔案不是支援的圖片")
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() || info.Size() == 0 || info.Size() > maxUploadFileBytes {
		return clipboardImageData{}, errors.New("剪貼簿圖片檔案無效")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return clipboardImageData{}, err
	}
	mimeType := detectMimeData(info.Name(), data)
	if extension == ".bmp" {
		decoded, _, err := image.Decode(bytes.NewReader(data))
		if err != nil {
			return clipboardImageData{}, err
		}
		data, err = encodeClipboardPNG(decoded)
		if err != nil {
			return clipboardImageData{}, err
		}
		extension = ".png"
		mimeType = "image/png"
	}
	if extension != ".svg" {
		if _, _, err := image.DecodeConfig(bytes.NewReader(data)); err != nil {
			return clipboardImageData{}, errors.New("剪貼簿圖片格式無效")
		}
	}
	return clipboardImageData{
		filename: clipboardFilename(strings.TrimPrefix(extension, ".")),
		mime:     mimeType,
		data:     data,
	}, nil
}

func clipboardFilename(extension string) string {
	if extension == "" {
		extension = "png"
	}
	return "clipboard-" + time.Now().Format("20060102-150405") + "." + extension
}
