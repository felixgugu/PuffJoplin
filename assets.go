package main

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const (
	uploadHeader         = "X-PuffJoplin-Upload"
	maxUploadFileBytes   = 50 << 20
	maxUploadRequestSize = 100 << 20
)

type vditorUploadResponse struct {
	Code int                    `json:"code"`
	Msg  string                 `json:"msg"`
	Data vditorUploadResultData `json:"data"`
}

type vditorUploadResultData struct {
	ErrFiles []string          `json:"errFiles"`
	SuccMap  map[string]string `json:"succMap"`
}

func (a *App) ServeUpload(w http.ResponseWriter, r *http.Request) bool {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeUploadError(w, http.StatusMethodNotAllowed, "只接受 POST 上傳")
		return true
	}
	if a.uploadToken == "" || !constantTimeEqual(r.Header.Get(uploadHeader), a.uploadToken) {
		writeUploadError(w, http.StatusForbidden, "上傳驗證失敗")
		return true
	}
	store, err := a.readyStore()
	if err != nil {
		writeUploadError(w, http.StatusServiceUnavailable, err.Error())
		return true
	}
	noteID := strings.TrimSpace(r.URL.Query().Get("noteId"))
	if noteID == "" {
		writeUploadError(w, http.StatusBadRequest, "缺少筆記 ID")
		return true
	}
	if _, err := store.GetNote(r.Context(), noteID); err != nil {
		writeUploadError(w, http.StatusNotFound, "筆記不存在")
		return true
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadRequestSize)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		status := http.StatusBadRequest
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			status = http.StatusRequestEntityTooLarge
		}
		writeUploadError(w, status, "無法讀取上傳內容")
		return true
	}
	files := r.MultipartForm.File["file[]"]
	if len(files) == 0 {
		writeUploadError(w, http.StatusBadRequest, "沒有可上傳的檔案")
		return true
	}
	for _, header := range files {
		if header.Size > maxUploadFileBytes {
			writeUploadError(w, http.StatusRequestEntityTooLarge, "單一檔案不可超過 50 MB")
			return true
		}
	}

	result := vditorUploadResponse{
		Data: vditorUploadResultData{
			ErrFiles: []string{},
			SuccMap:  make(map[string]string, len(files)),
		},
	}
	unlock := a.lockResourceMaintenance()
	defer unlock()
	for _, header := range files {
		file, err := header.Open()
		if err != nil {
			writeUploadError(w, http.StatusBadRequest, "無法開啟上傳檔案")
			return true
		}
		data, readErr := io.ReadAll(io.LimitReader(file, maxUploadFileBytes+1))
		closeErr := file.Close()
		if readErr != nil || closeErr != nil {
			writeUploadError(w, http.StatusBadRequest, "無法讀取上傳檔案")
			return true
		}
		if len(data) > maxUploadFileBytes {
			writeUploadError(w, http.StatusRequestEntityTooLarge, "單一檔案不可超過 50 MB")
			return true
		}
		if len(data) == 0 {
			writeUploadError(w, http.StatusBadRequest, "附件不可為空")
			return true
		}
		resource, err := store.AddResourceData(r.Context(), noteID, header.Filename, data)
		if err != nil {
			writeUploadError(w, http.StatusInternalServerError, "無法儲存附件")
			return true
		}
		result.Data.SuccMap[filepath.Base(strings.ReplaceAll(header.Filename, `\`, "/"))] = resource.URL
	}
	writeJSON(w, http.StatusOK, result)
	return true
}

func constantTimeEqual(left string, right string) bool {
	if len(left) != len(right) {
		return false
	}
	var difference byte
	for index := range left {
		difference |= left[index] ^ right[index]
	}
	return difference == 0
}

func writeUploadError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, vditorUploadResponse{
		Code: 1,
		Msg:  message,
		Data: vditorUploadResultData{ErrFiles: []string{}, SuccMap: map[string]string{}},
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func (a *App) ServeResources(w http.ResponseWriter, r *http.Request) bool {
	if !strings.HasPrefix(r.URL.Path, "/resources/") {
		return false
	}
	id := strings.TrimPrefix(r.URL.Path, "/resources/")
	if id == "" || strings.ContainsAny(id, `/\`) || strings.Contains(id, "..") {
		http.NotFound(w, r)
		return true
	}
	if a.store != nil {
		resource, err := a.store.Resource(r.Context(), id)
		if err == nil {
			path := a.store.storedResourcePath(resource)
			if stat, statErr := os.Stat(path); statErr == nil && !stat.IsDir() {
				if contentType := mime.TypeByExtension(filepath.Ext(resource.Filename)); contentType != "" {
					w.Header().Set("Content-Type", contentType)
				} else if resource.Mime != "" {
					w.Header().Set("Content-Type", resource.Mime)
				}
				w.Header().Set("Cache-Control", "private, no-cache")
				http.ServeFile(w, r, path)
				return true
			}
		}
	}
	http.NotFound(w, r)
	return true
}
