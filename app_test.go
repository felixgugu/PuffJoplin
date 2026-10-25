package main

import "testing"

func TestSanitizePreviewImageFilename(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: `screen:shot?.png`, want: "screen-shot-.png"},
		{input: `folder/image.jpg`, want: "image.png"},
		{input: `  ..  `, want: "PuffJoplin-image.png"},
		{input: `diagram`, want: "diagram.png"},
	}
	for _, test := range tests {
		if got := sanitizePreviewImageFilename(test.input); got != test.want {
			t.Errorf("sanitizePreviewImageFilename(%q) = %q, want %q", test.input, got, test.want)
		}
	}
}

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
