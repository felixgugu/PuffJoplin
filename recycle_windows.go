//go:build windows

package main

import (
	"errors"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	foDelete          = 0x0003
	fofSilent         = 0x0004
	fofNoConfirmation = 0x0010
	fofAllowUndo      = 0x0040
	fofNoErrorUI      = 0x0400
)

type shFileOperation struct {
	Window               windows.HWND
	Operation            uint32
	From                 *uint16
	To                   *uint16
	Flags                uint16
	AnyOperationsAborted int32
	NameMappings         uintptr
	ProgressTitle        *uint16
}

var procSHFileOperation = windows.NewLazySystemDLL("shell32.dll").NewProc("SHFileOperationW")

func recycleManagedFile(path string) error {
	source, err := windows.UTF16FromString(path)
	if err != nil {
		return err
	}
	source = append(source, 0)
	operation := shFileOperation{
		Operation: foDelete,
		From:      &source[0],
		Flags:     fofAllowUndo | fofNoConfirmation | fofNoErrorUI | fofSilent,
	}
	result, _, _ := procSHFileOperation.Call(uintptr(unsafe.Pointer(&operation)))
	if result != 0 {
		return errors.New("無法將 Markdown 檔案移至資源回收筒")
	}
	if operation.AnyOperationsAborted != 0 {
		return errors.New("已取消移至資源回收筒")
	}
	return nil
}
