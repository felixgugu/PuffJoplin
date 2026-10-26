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
