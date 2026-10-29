package main

import "testing"

func TestNoteSnippetCleansMarkdown(t *testing.T) {
	cases := []struct {
		name string
		body string
		want string
	}{
		{name: "empty", body: "", want: ""},
		{name: "plain text", body: "Just a note", want: "Just a note"},
		{name: "headings and emphasis", body: "# Heading\n\nSome **bold** and _italic_ text", want: "Heading Some bold and italic text"},
		{name: "quote and list markers", body: "> quote\n- item\n* other", want: "quote item other"},
		{name: "inline code", body: "Run `go test` now", want: "Run go test now"},
		{name: "link", body: "See [the docs](https://example.com/a) now", want: "See the docs now"},
		{name: "image", body: "Before ![alt text](img.png) after", want: "Before alt text after"},
		{name: "image without alt", body: "Before ![](img.png) after", want: "Before after"},
		{name: "empty link label", body: "Before [](x) after", want: "Before [](x) after"},
		{name: "empty link target", body: "Before [label]() after", want: "Before [label]() after"},
		{name: "nested brackets", body: "[[nested]](x)", want: "[[nested]](x)"},
		{name: "url with closing paren", body: "[a](x)y)", want: "ay)"},
		{name: "crlf", body: "line one\r\nline two", want: "line one line two"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := noteSnippet(testCase.body, 180); got != testCase.want {
				t.Fatalf("noteSnippet(%q) = %q, want %q", testCase.body, got, testCase.want)
			}
		})
	}
}

func TestNoteSnippetTruncatesByRune(t *testing.T) {
	if got := noteSnippet("產品路線圖測試", 3); got != "產品路…" {
		t.Fatalf("truncated snippet = %q", got)
	}
}
