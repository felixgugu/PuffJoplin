//go:build !windows

package main

import "os"

func recycleManagedFile(path string) error {
	return os.Remove(path)
}
