package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx             context.Context
	store           *Store
	instanceLock    *InstanceLock
	dataDir         string
	logsDir         string
	resourcesDir    string
	uploadToken     string
	initErr         error
	logger          *log.Logger
	logFile         *os.File
	mu              sync.Mutex
	managedMu       sync.Mutex
	managedWatchers map[string]*managedRootWatcher
}

func NewApp() *App {
	dataDir := resolveDataDir()
	app := &App{
		dataDir:         dataDir,
		logsDir:         filepath.Join(dataDir, "logs"),
		resourcesDir:    filepath.Join(dataDir, "resources"),
		managedWatchers: make(map[string]*managedRootWatcher),
	}
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		app.initErr = fmt.Errorf("無法建立上傳驗證權杖: %w", err)
		return app
	}
	app.uploadToken = hex.EncodeToString(token)
	app.initErr = app.initialize()
	return app
}

func resolveDataDir() string {
	if override := strings.TrimSpace(os.Getenv("PUFFJOPLIN_DATA_DIR")); override != "" {
		absolute, err := filepath.Abs(override)
		if err == nil {
			return absolute
		}
	}
	executable, err := os.Executable()
	if err != nil {
		return filepath.Join(".", "data")
	}
	return filepath.Join(filepath.Dir(executable), "data")
}

func (a *App) initialize() error {
	for _, dir := range []string{a.dataDir, a.logsDir, a.resourcesDir} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("無法建立資料目錄 %s: %w", dir, err)
		}
	}
	probe, err := os.CreateTemp(a.dataDir, ".write-test-*")
	if err != nil {
		return fmt.Errorf("資料目錄不可寫入: %w", err)
	}
	probeName := probe.Name()
	probe.Close()
	_ = os.Remove(probeName)

	a.openLogger()
	lock, err := AcquireInstanceLock(a.dataDir)
	if err != nil {
		return err
	}
	a.instanceLock = lock

	store, err := OpenStore(filepath.Join(a.dataDir, "puffjoplin.sqlite"), a.resourcesDir)
	if err != nil {
		return err
	}
	a.store = store
	a.logger.Printf("PuffJoplin started; data=%s", a.dataDir)
	return nil
}

func (a *App) openLogger() {
	logPath := filepath.Join(a.logsDir, "puffjoplin.log")
	if stat, err := os.Stat(logPath); err == nil && stat.Size() > 5*1024*1024 {
		_ = os.Rename(logPath, logPath+".1")
	}
	file, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		a.logger = log.New(io.Discard, "", log.LstdFlags)
		return
	}
	a.logFile = file
	a.logger = log.New(io.MultiWriter(file, os.Stderr), "", log.LstdFlags)
}

func (a *App) OnStartup(ctx context.Context) {
	a.ctx = ctx
	if a.initErr != nil {
		runtime.EventsEmit(ctx, "app.error", a.initErr.Error())
		return
	}
	a.startManagedWatchers()
}

func (a *App) SetWindowTheme(theme string) {
	if a.ctx == nil {
		return
	}
	if theme == "dark" {
		runtime.WindowSetDarkTheme(a.ctx)
		return
	}
	runtime.WindowSetLightTheme(a.ctx)
}

func (a *App) ReportFrontendError(message string, stack string, source string) error {
	if a.logger == nil {
		return nil
	}
	message = strings.TrimSpace(message)
	if message == "" {
		message = "未知前端錯誤"
	}
	a.logger.Printf("Frontend error [%s]: %s\n%s", strings.TrimSpace(source), message, strings.TrimSpace(stack))
	return nil
}

func (a *App) OnShutdown(context.Context) {
	a.stopManagedWatchers()
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.store != nil {
		_ = a.store.Close()
		a.store = nil
	}
	if a.instanceLock != nil {
		a.instanceLock.Release()
		a.instanceLock = nil
	}
	if a.logFile != nil {
		_ = a.logFile.Close()
		a.logFile = nil
	}
}

func (a *App) AssetHandler() http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/upload" {
			a.ServeUpload(writer, request)
			return
		}
		if a.ServeResources(writer, request) {
			return
		}
		http.NotFound(writer, request)
	})
}

func (a *App) readyStore() (*Store, error) {
	if a.initErr != nil {
		return nil, a.initErr
	}
	if a.store == nil {
		return nil, errors.New("資料庫尚未初始化")
	}
	return a.store, nil
}

func (a *App) Bootstrap() (BootstrapState, error) {
	store, err := a.readyStore()
	if err != nil {
		return BootstrapState{
			Status:     "error",
			AppVersion: "0.1.0",
			DataDir:    a.dataDir,
			Message:    err.Error(),
		}, err
	}
	profilePath := discoverJoplinProfile()
	state, err := store.Bootstrap(a.ctx, a.dataDir, profilePath)
	if err != nil {
		return state, err
	}
	status, exists, err := store.GetSetting(a.ctx, "onboarding.joplinImport")
	if err != nil {
		return state, err
	}
	if !exists || strings.TrimSpace(status) == "" {
		status = "pending"
	}
	status = strings.Trim(strings.TrimSpace(status), `"`)
	state.OnboardingStatus = status
	state.OnboardingRequired = state.NoteCount == 0 && state.CanImportJoplin &&
		status != "imported" && status != "dismissed"
	state.UploadToken = a.uploadToken
	return state, nil
}

func (a *App) InspectJoplinProfile() (JoplinProfilePreview, error) {
	profilePath := discoverJoplinProfile()
	if profilePath == "" {
		return JoplinProfilePreview{
			Available: false,
			Error:     "找不到可用的 Joplin profile",
		}, nil
	}
	normalized, err := normalizeJoplinProfilePath(profilePath)
	if err != nil {
		return JoplinProfilePreview{
			Available:   false,
			ProfilePath: profilePath,
			Error:       err.Error(),
		}, nil
	}
	return inspectJoplinProfile(normalized)
}

func (a *App) DismissJoplinImportPrompt() error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	return store.SetSetting(a.ctx, "onboarding.joplinImport", "dismissed")
}

func (a *App) ListNotebooks() ([]Notebook, error) {
	store, err := a.readyStore()
	if err != nil {
		return nil, err
	}
	return store.ListNotebooks(a.ctx)
}

func (a *App) CreateNotebook(title string, parentID string) (Notebook, error) {
	store, err := a.readyStore()
	if err != nil {
		return Notebook{}, err
	}
	item, err := store.CreateNotebook(a.ctx, title, parentID)
	if err == nil {
		runtime.EventsEmit(a.ctx, "notebooks.changed", item.ID)
		if item.StorageKind == storageKindDirectory {
			runtime.EventsEmit(a.ctx, "notes.changed", "")
		}
	}
	return item, err
}

func (a *App) RenameNotebook(id string, title string) (Notebook, error) {
	store, err := a.readyStore()
	if err != nil {
		return Notebook{}, err
	}
	item, err := store.RenameNotebook(a.ctx, id, title)
	if err == nil {
		runtime.EventsEmit(a.ctx, "notebooks.changed", item.ID)
	}
	return item, err
}

func (a *App) DeleteNotebook(id string, deleteChildren bool) error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	notebook, err := store.getNotebook(a.ctx, id)
	if err != nil {
		return errors.New("筆記本不存在")
	}
	if err := store.DeleteNotebook(a.ctx, id, deleteChildren); err != nil {
		return err
	}
	if notebook.StorageKind == storageKindDirectory && notebook.StoragePath == "" {
		a.stopManagedWatcher(id)
	}
	runtime.EventsEmit(a.ctx, "notebooks.changed", id)
	runtime.EventsEmit(a.ctx, "notes.changed", "")
	return nil
}

func (a *App) ListNotes(query NoteQuery) (NotePage, error) {
	store, err := a.readyStore()
	if err != nil {
		return NotePage{}, err
	}
	return store.ListNotes(a.ctx, query)
}

func (a *App) SearchNotes(search string, limit int) ([]NoteSummary, error) {
	store, err := a.readyStore()
	if err != nil {
		return nil, err
	}
	return store.SearchNotes(a.ctx, search, limit)
}

func (a *App) GetNote(id string) (Note, error) {
	store, err := a.readyStore()
	if err != nil {
		return Note{}, err
	}
	return store.GetNote(a.ctx, id)
}

func (a *App) CreateNote(notebookID string, title string, body string) (Note, error) {
	store, err := a.readyStore()
	if err != nil {
		return Note{}, err
	}
	note, err := store.CreateNote(a.ctx, notebookID, title, body)
	if err == nil {
		runtime.EventsEmit(a.ctx, "notes.changed", note.ID)
	}
	return note, err
}

func (a *App) UpdateNote(input NoteInput) (Note, error) {
	store, err := a.readyStore()
	if err != nil {
		return Note{}, err
	}
	note, err := store.UpdateNote(a.ctx, input)
	if err == nil {
		runtime.EventsEmit(a.ctx, "notes.changed", note.ID)
	}
	return note, err
}

func (a *App) MoveNote(id string, notebookID string) (Note, error) {
	store, err := a.readyStore()
	if err != nil {
		return Note{}, err
	}
	note, err := store.MoveNote(a.ctx, id, notebookID)
	if err == nil {
		runtime.EventsEmit(a.ctx, "notes.changed", note.ID)
	}
	return note, err
}

func (a *App) SetNotePinned(id string, pinned bool) error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	if err := store.SetNotePinned(a.ctx, id, pinned); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "notes.changed", id)
	return nil
}

func (a *App) TrashNote(id string) error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	if err := store.TrashNote(a.ctx, id); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "notes.changed", id)
	return nil
}

func (a *App) RestoreNote(id string) error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	if err := store.RestoreNote(a.ctx, id); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "notes.changed", id)
	return nil
}

func (a *App) DeleteNotePermanently(id string) error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	if err := store.DeleteNotePermanently(a.ctx, id); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "notes.changed", id)
	return nil
}

func (a *App) ListTags() ([]Tag, error) {
	store, err := a.readyStore()
	if err != nil {
		return nil, err
	}
	return store.ListTags(a.ctx)
}

func (a *App) SetNoteTags(noteID string, tags []string) error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	if err := store.SetNoteTags(a.ctx, noteID, tags); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "notes.changed", noteID)
	runtime.EventsEmit(a.ctx, "tags.changed", "")
	return nil
}

func (a *App) Settings() (map[string]string, error) {
	store, err := a.readyStore()
	if err != nil {
		return nil, err
	}
	return store.Settings(a.ctx)
}

func (a *App) SetSetting(key string, value string) error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	if key == "" {
		return errors.New("設定名稱不可為空")
	}
	return store.SetSetting(a.ctx, key, value)
}

func (a *App) SelectJoplinProfile() (string, error) {
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                "選擇 Joplin profile 或資料夾",
		DefaultDirectory:     filepath.Dir(discoverJoplinProfile()),
		CanCreateDirectories: false,
	})
	if err != nil || path == "" {
		return path, err
	}
	return normalizeJoplinProfilePath(path)
}

func (a *App) ImportJoplinProfile(sourcePath string) (ImportReport, error) {
	store, err := a.readyStore()
	if err != nil {
		return ImportReport{}, err
	}
	if sourcePath == "" {
		sourcePath, err = a.SelectJoplinProfile()
		if err != nil {
			return ImportReport{}, err
		}
		if sourcePath == "" {
			return ImportReport{}, errors.New("未選擇 Joplin profile")
		}
	}
	profilePath, err := normalizeJoplinProfilePath(sourcePath)
	if err != nil {
		return ImportReport{}, err
	}
	report, err := importJoplinProfile(a.ctx, store, profilePath, func(progress float64, message string) {
		runtime.EventsEmit(a.ctx, "import.progress", map[string]any{"progress": progress, "message": message})
	})
	if err == nil {
		_ = store.SetSetting(a.ctx, "onboarding.joplinImport", "imported")
		runtime.EventsEmit(a.ctx, "notes.changed", "")
		runtime.EventsEmit(a.ctx, "notebooks.changed", "")
		runtime.EventsEmit(a.ctx, "tags.changed", "")
		runtime.EventsEmit(a.ctx, "import.finished", report)
	}
	return report, err
}

func (a *App) ImportArchive(sourcePath string) (ImportReport, error) {
	return a.importArchive(sourcePath, "")
}

func (a *App) ImportArchiveToNotebook(notebookID string, sourcePath string) (ImportReport, error) {
	store, err := a.readyStore()
	if err != nil {
		return ImportReport{}, err
	}
	if _, err := store.getNotebook(a.ctx, notebookID); err != nil {
		return ImportReport{}, errors.New("目的筆記本不存在")
	}
	return a.importArchive(sourcePath, notebookID)
}

func (a *App) importArchive(sourcePath string, destinationNotebookID string) (ImportReport, error) {
	store, err := a.readyStore()
	if err != nil {
		return ImportReport{}, err
	}
	if sourcePath == "" {
		sourcePath, err = runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
			Title: "匯入筆記",
			Filters: []runtime.FileFilter{
				{DisplayName: "Joplin / Evernote / Markdown", Pattern: "*.jex;*.enex;*.md;*.markdown"},
			},
		})
		if err != nil {
			return ImportReport{}, err
		}
		if sourcePath == "" {
			return ImportReport{}, errors.New("未選擇檔案")
		}
	}
	report, err := importArchive(a.ctx, store, sourcePath, destinationNotebookID, func(progress float64, message string) {
		runtime.EventsEmit(a.ctx, "import.progress", map[string]any{"progress": progress, "message": message})
	})
	if err == nil {
		runtime.EventsEmit(a.ctx, "notes.changed", "")
		runtime.EventsEmit(a.ctx, "notebooks.changed", "")
		runtime.EventsEmit(a.ctx, "tags.changed", "")
		runtime.EventsEmit(a.ctx, "import.finished", report)
	}
	return report, err
}

func (a *App) ExportNotebook(notebookID string, format string) (string, error) {
	store, err := a.readyStore()
	if err != nil {
		return "", err
	}
	format = strings.ToLower(strings.TrimSpace(format))
	if format == "" {
		format = "jex"
	}
	if format != "jex" && format != "md" {
		return "", errors.New("不支援的匯出格式")
	}
	extension := "." + format
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "匯出筆記本",
		DefaultFilename: "PuffJoplin-Export" + extension,
		Filters: []runtime.FileFilter{
			{DisplayName: strings.ToUpper(format), Pattern: "*" + extension},
		},
	})
	if err != nil || path == "" {
		return path, err
	}
	if !strings.HasSuffix(strings.ToLower(path), extension) {
		path += extension
	}
	if format == "jex" {
		err = exportJEX(a.ctx, store, notebookID, path)
	} else {
		err = exportMarkdown(a.ctx, store, notebookID, path)
	}
	return path, err
}

func (a *App) ExportNote(request NoteExportRequest) (string, error) {
	store, err := a.readyStore()
	if err != nil {
		return "", err
	}
	request.NoteID = strings.TrimSpace(request.NoteID)
	request.Format = strings.ToLower(strings.TrimSpace(request.Format))
	if request.NoteID == "" {
		return "", errors.New("缺少筆記 ID")
	}
	if request.Format != "pdf" && request.Format != "html" {
		return "", errors.New("不支援的筆記匯出格式")
	}
	if strings.TrimSpace(request.HTML) == "" {
		return "", errors.New("筆記內容尚未載入完成")
	}
	note, err := store.GetNote(a.ctx, request.NoteID)
	if err != nil {
		return "", errors.New("筆記不存在")
	}
	filename := safeFilename(note.Title)
	if filename == "" {
		filename = "PuffJoplin-note"
	}
	extension := "." + request.Format
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "匯出目前筆記",
		DefaultFilename: filename + extension,
		Filters: []runtime.FileFilter{
			{DisplayName: strings.ToUpper(request.Format), Pattern: "*" + extension},
		},
	})
	if err != nil || path == "" {
		return path, err
	}
	if !strings.HasSuffix(strings.ToLower(path), extension) {
		path += extension
	}
	document, err := buildNoteExportHTML(a.ctx, store, note, request.HTML)
	if err != nil {
		return "", err
	}
	if request.Format == "html" {
		if err := os.WriteFile(path, []byte(document), 0o644); err != nil {
			return "", err
		}
		return path, nil
	}
	browserPath, err := findPDFBrowser()
	if err != nil {
		return "", err
	}
	if err := renderNotePDF(a.ctx, document, path, browserPath); err != nil {
		return "", err
	}
	return path, nil
}

func (a *App) AttachResource(noteID string) (Note, error) {
	store, err := a.readyStore()
	if err != nil {
		return Note{}, err
	}
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "附加檔案",
	})
	if err != nil || path == "" {
		return Note{}, err
	}
	resource, err := store.AddResource(a.ctx, noteID, path)
	if err != nil {
		return Note{}, err
	}
	note, err := store.GetNote(a.ctx, noteID)
	if err != nil {
		return Note{}, err
	}
	link := fmt.Sprintf("\n\n[%s](%s)\n", resource.Title, resource.URL)
	if strings.HasPrefix(resource.Mime, "image/") {
		link = fmt.Sprintf("\n\n![%s](%s)\n", resource.Title, resource.URL)
	}
	input := noteInputFromNote(note)
	input.Body += link
	note, err = store.UpdateNote(a.ctx, input)
	if err == nil {
		runtime.EventsEmit(a.ctx, "notes.changed", note.ID)
	}
	return note, err
}

func (a *App) PasteClipboardImage(noteID string) (Resource, error) {
	store, err := a.readyStore()
	if err != nil {
		return Resource{}, err
	}
	noteID = strings.TrimSpace(noteID)
	if noteID == "" {
		return Resource{}, errors.New("缺少筆記 ID")
	}
	if _, err := store.GetNote(a.ctx, noteID); err != nil {
		return Resource{}, errors.New("筆記不存在")
	}
	image, err := readClipboardImage()
	if err != nil {
		return Resource{}, err
	}
	if len(image.data) == 0 {
		return Resource{}, errors.New("剪貼簿圖片是空的")
	}
	resource, err := store.AddResourceData(a.ctx, noteID, image.filename, image.data)
	if err != nil {
		return Resource{}, err
	}
	runtime.EventsEmit(a.ctx, "notes.changed", noteID)
	return resource, nil
}

func (a *App) OpenResource(id string) error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	resource, err := store.Resource(a.ctx, id)
	if err != nil {
		return err
	}
	path := store.storedResourcePath(resource)
	if _, err := os.Stat(path); err != nil {
		return err
	}
	if !safeToOpenResource(resource.Filename) {
		return errors.New("此附件類型不會直接執行，請使用「另存新檔」或資料夾中的附件")
	}
	return exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", path).Start()
}

func (a *App) RevealResource(id string) error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	resource, err := store.Resource(a.ctx, id)
	if err != nil {
		return err
	}
	path := store.storedResourcePath(resource)
	return exec.Command("explorer.exe", "/select,", path).Start()
}

func (a *App) SaveResourceAs(id string) (string, error) {
	store, err := a.readyStore()
	if err != nil {
		return "", err
	}
	resource, err := store.Resource(a.ctx, id)
	if err != nil {
		return "", err
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "另存附件",
		DefaultFilename: resource.Filename,
	})
	if err != nil || path == "" {
		return path, err
	}
	if err := copyFile(store.storedResourcePath(resource), path); err != nil {
		return "", err
	}
	return path, nil
}

func (a *App) OpenExternal(value string) error {
	parsed, err := url.Parse(value)
	if err != nil {
		return err
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https", "mailto":
		runtime.BrowserOpenURL(a.ctx, value)
		return nil
	default:
		return errors.New("不允許開啟此連結")
	}
}

func (a *App) OpenDataFolder() error {
	return exec.Command("explorer.exe", a.dataDir).Start()
}

func (a *App) Confirm(title string, message string) (bool, error) {
	response, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         title,
		Message:       message,
		Buttons:       []string{"No", "Yes"},
		DefaultButton: "No",
	})
	return confirmDialogResult(response), err
}

func confirmDialogResult(response string) bool {
	switch strings.ToLower(strings.TrimSpace(response)) {
	case "yes", "ok", "確定":
		return true
	default:
		return false
	}
}

func (a *App) Quit() {
	runtime.Quit(a.ctx)
}

func noteInputFromNote(note Note) NoteInput {
	return NoteInput{
		ID: note.ID, NotebookID: note.NotebookID, Title: note.Title, Body: note.Body,
		IsTodo: note.IsTodo, TodoDue: note.TodoDue, TodoCompleted: note.TodoCompleted,
		SourceURL: note.SourceURL, Author: note.Author,
	}
}

func (a *App) storeImportReport(ctx context.Context, report ImportReport) {
	data, err := json.Marshal(report)
	if err != nil {
		return
	}
	_, _ = a.store.db.ExecContext(ctx,
		`INSERT INTO import_jobs(id, source, kind, report_json, created_at) VALUES(?, ?, ?, ?, ?)`,
		newID(), report.Source, report.Kind, string(data), nowMillis(),
	)
}
