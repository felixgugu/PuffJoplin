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
