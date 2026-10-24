//go:build !windows

package main

type InstanceLock struct{}

func AcquireInstanceLock(string) (*InstanceLock, error) {
	return &InstanceLock{}, nil
}

func (l *InstanceLock) Release() {}
