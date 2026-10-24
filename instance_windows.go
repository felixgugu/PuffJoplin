//go:build windows

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"

	"golang.org/x/sys/windows"
)

type InstanceLock struct {
	handle windows.Handle
}

func AcquireInstanceLock(dataDir string) (*InstanceLock, error) {
	hash := sha256.Sum256([]byte(dataDir))
	name := `Local\PuffJoplin-` + hex.EncodeToString(hash[:8])
	namePtr, err := windows.UTF16PtrFromString(name)
	if err != nil {
		return nil, err
	}
	handle, err := windows.CreateMutex(nil, false, namePtr)
	if err != nil {
		return nil, err
	}
	if windows.GetLastError() == windows.ERROR_ALREADY_EXISTS {
		windows.CloseHandle(handle)
		return nil, errors.New("PuffJoplin 已經在使用這份資料")
	}
	return &InstanceLock{handle: handle}, nil
}

func (l *InstanceLock) Release() {
	if l != nil && l.handle != 0 {
		_ = windows.CloseHandle(l.handle)
		l.handle = 0
	}
}
