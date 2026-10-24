package main

import "testing"

func TestConfirmDialogResult(t *testing.T) {
	for _, response := range []string{"Yes", "yes", " OK ", "確定"} {
		if !confirmDialogResult(response) {
			t.Fatalf("expected confirmation for %q", response)
		}
	}
	for _, response := range []string{"No", "Cancel", "", "取消"} {
		if confirmDialogResult(response) {
			t.Fatalf("unexpected confirmation for %q", response)
		}
	}
}
