package main

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

const testUploadToken = "0123456789abcdef0123456789abcdef"

func newUploadTestApp(t *testing.T) (*App, Note) {
	t.Helper()
	store := newTestStore(t)
	notebooks, err := store.ListNotebooks(context.Background())
	if err != nil || len(notebooks) == 0 {
		t.Fatalf("list notebooks: %v", err)
	}
	note, err := store.CreateNote(context.Background(), notebooks[0].ID, "Upload test", "")
	if err != nil {
		t.Fatalf("create note: %v", err)
	}
	return &App{store: store, uploadToken: testUploadToken}, note
}

func uploadRequest(t *testing.T, noteID string, token string, filename string, data []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file[]", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/upload?noteId="+noteID, &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set(uploadHeader, token)
	return request
}

func TestServeUploadStoresClipboardImage(t *testing.T) {
	app, note := newUploadTestApp(t)
	image := []byte("\x89PNG\r\n\x1a\nclipboard-image")
	request := uploadRequest(t, note.ID, testUploadToken, `..\clipboard.png`, image)
	recorder := httptest.NewRecorder()

	app.ServeUpload(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response vditorUploadResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	url := response.Data.SuccMap["clipboard.png"]
	if response.Code != 0 || !strings.HasPrefix(url, "/resources/") {
		t.Fatalf("unexpected response: %#v", response)
	}
	id := strings.TrimPrefix(url, "/resources/")
	resource, err := app.store.Resource(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	if resource.Filename != "clipboard.png" || resource.Mime != "image/png" {
		t.Fatalf("unexpected resource: %#v", resource)
	}
	stored, err := os.ReadFile(app.store.resourcePath(id))
	if err != nil || !bytes.Equal(stored, image) {
		t.Fatalf("stored image mismatch: %v", err)
	}
}

func TestServeUploadRejectsInvalidTokenAndNote(t *testing.T) {
	app, note := newUploadTestApp(t)
	for _, testCase := range []struct {
		name   string
		noteID string
		token  string
		status int
	}{
		{name: "invalid token", noteID: note.ID, token: "wrong", status: http.StatusForbidden},
		{name: "missing note", noteID: "missing", token: testUploadToken, status: http.StatusNotFound},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			request := uploadRequest(t, testCase.noteID, testCase.token, "image.png", []byte("image"))
			recorder := httptest.NewRecorder()
			app.ServeUpload(recorder, request)
			if recorder.Code != testCase.status {
				t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestServeUploadRejectsOversizedFile(t *testing.T) {
	app, note := newUploadTestApp(t)
	request := uploadRequest(t, note.ID, testUploadToken, "large.png", bytes.Repeat([]byte("x"), maxUploadFileBytes+1))
	recorder := httptest.NewRecorder()

	app.ServeUpload(recorder, request)

	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestServeUploadRejectsEmptyFile(t *testing.T) {
	app, note := newUploadTestApp(t)
	request := uploadRequest(t, note.ID, testUploadToken, "empty.png", nil)
	recorder := httptest.NewRecorder()

	app.ServeUpload(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "/resources/") {
		t.Fatalf("empty upload unexpectedly created a resource: %s", recorder.Body.String())
	}
}
