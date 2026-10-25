//go:build !windows

package main

import "errors"

type clipboardImageData struct {
	filename string
	mime     string
	data     []byte
}

func readClipboardImage() (clipboardImageData, error) {
	return clipboardImageData{}, errors.New("目前僅支援 Windows 剪貼簿圖片")
}

func writeClipboardImagePNG(_ []byte) error {
	return errors.New("目前僅支援 Windows 剪貼簿圖片")
}

func writeClipboardImageFile(_ string) error {
	return errors.New("目前僅支援 Windows 剪貼簿檔案")
}

func writeClipboardText(_ string) error {
	return errors.New("目前僅支援 Windows 剪貼簿文字")
}
