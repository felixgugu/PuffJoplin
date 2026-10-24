package main

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const maxNotebookDocxBytes = 512 << 20

var localResourceReferencePattern = regexp.MustCompile(
	`(^|[^A-Za-z0-9])(?:/resources/|:/)([A-Za-z0-9]{32})`,
)

var windowsReservedFilenames = map[string]bool{
	"con": true, "prn": true, "aux": true, "nul": true,
	"com1": true, "com2": true, "com3": true, "com4": true, "com5": true,
	"com6": true, "com7": true, "com8": true, "com9": true,
	"lpt1": true, "lpt2": true, "lpt3": true, "lpt4": true, "lpt5": true,
	"lpt6": true, "lpt7": true, "lpt8": true, "lpt9": true,
}

type notebookExportTree struct {
	Notebooks    map[string]Notebook
	FolderByID   map[string]string
	ChildrenByID map[string][]Notebook
}

type exportedResourceWriter struct {
	destinationRoot string
	byResourceID    map[string]string
	bySourcePath    map[string]string
	usedNames       map[string]map[string]bool
}

func (a *App) PrepareNotebookDocxExport(notebookID string) (NotebookDocxExport, error) {
	store, err := a.readyStore()
	if err != nil {
		return NotebookDocxExport{}, err
	}
	notebook, err := store.getNotebook(a.ctx, strings.TrimSpace(notebookID))
	if err != nil {
		return NotebookDocxExport{}, errors.New("筆記本不存在")
	}
	defaultFilename := safeExportName(notebook.Title, "PuffJoplin-notebook") + ".docx"
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "匯出筆記本為 DOCX",
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "Word 文件", Pattern: "*.docx"},
		},
	})
	if err != nil || path == "" {
		return NotebookDocxExport{Path: path}, err
	}
	path = ensureFileExtension(path, ".docx")
	markdown, err := buildNotebookDocxMarkdown(a.ctx, store, notebook.ID)
	if err != nil {
		return NotebookDocxExport{}, err
	}
	return NotebookDocxExport{
		Path:            path,
		DefaultFilename: defaultFilename,
		Markdown:        markdown,
	}, nil
}

func (a *App) SaveDocxExport(path string, dataBase64 string) error {
	path = strings.TrimSpace(path)
	if path == "" {
		return errors.New("缺少 DOCX 匯出路徑")
	}
	if !filepath.IsAbs(path) {
		return errors.New("DOCX 匯出路徑必須是絕對路徑")
	}
	path = ensureFileExtension(path, ".docx")
	data, err := base64.StdEncoding.DecodeString(strings.TrimSpace(dataBase64))
	if err != nil {
		return errors.New("DOCX 內容格式無效")
	}
	if len(data) < 4 || len(data) > maxNotebookDocxBytes || string(data[:4]) != "PK\x03\x04" {
		return errors.New("DOCX 內容無效")
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("無法寫入 DOCX: %w", err)
	}
	return nil
}

func exportMarkdown(ctx context.Context, store *Store, notebookID string, destination string) error {
	destination, err := filepath.Abs(strings.TrimSpace(destination))
	if err != nil {
		return err
	}
	if err := os.MkdirAll(destination, 0o755); err != nil {
		return fmt.Errorf("無法建立 Markdown 匯出目錄: %w", err)
	}
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		return err
	}
	tree, err := buildNotebookExportTree(notebooks, notebookID)
	if err != nil {
		return err
	}
	if err := createNotebookExportFolders(destination, tree); err != nil {
		return err
	}
	notes, err := loadNotebookExportNotes(ctx, store, tree, notebookID)
	if err != nil {
		return err
	}
	resources := &exportedResourceWriter{
		destinationRoot: destination,
		byResourceID:    make(map[string]string),
		bySourcePath:    make(map[string]string),
		usedNames:       make(map[string]map[string]bool),
	}
	usedNoteNames := make(map[string]map[string]bool)
	for _, note := range notes {
		folder := tree.FolderByID[note.NotebookID]
		noteDir := filepath.Join(destination, filepath.FromSlash(folder))
		if err := os.MkdirAll(noteDir, 0o755); err != nil {
			return err
		}
		noteName := uniqueExportFilename(
			noteDir,
			safeExportName(note.Title, "未命名筆記"),
			".md",
			usedNoteNames,
		)
		notePath := filepath.Join(noteDir, noteName)
		body, err := rewriteNotebookMarkdownResources(ctx, store, note, notePath, resources)
		if err != nil {
			return err
		}
		if body != "" && !strings.HasSuffix(body, "\n") {
			body += "\n"
		}
		if err := os.WriteFile(notePath, []byte(body), 0o644); err != nil {
			return fmt.Errorf("無法寫入 %s: %w", noteName, err)
		}
	}
	return nil
}

func buildNotebookDocxMarkdown(ctx context.Context, store *Store, notebookID string) (string, error) {
	notebooks, err := store.ListNotebooks(ctx)
	if err != nil {
		return "", err
	}
	tree, err := buildNotebookExportTree(notebooks, notebookID)
	if err != nil {
		return "", err
	}
	notes, err := loadNotebookExportNotes(ctx, store, tree, notebookID)
	if err != nil {
		return "", err
	}
	root := tree.Notebooks[notebookID]
	var output strings.Builder
	output.WriteString("# ")
	output.WriteString(escapeMarkdownInline(root.Title))
	output.WriteString("\n\n")
	output.WriteString("> PuffJoplin 筆記本匯出\n\n")
	dataURLs := make(map[string]string)
	for _, note := range notes {
		output.WriteString("## ")
		output.WriteString(escapeMarkdownInline(note.Title))
		output.WriteString("\n\n")
		body, err := inlineNotebookMarkdownResources(ctx, store, note, note.Body, dataURLs)
		if err != nil {
			return "", err
		}
		output.WriteString(strings.TrimSpace(body))
		output.WriteString("\n\n---\n\n")
	}
	return strings.TrimSpace(output.String()) + "\n", nil
}

func buildNotebookExportTree(notebooks []Notebook, rootID string) (notebookExportTree, error) {
	tree := notebookExportTree{
		Notebooks:    make(map[string]Notebook, len(notebooks)),
		FolderByID:   make(map[string]string),
		ChildrenByID: make(map[string][]Notebook),
	}
	for _, notebook := range notebooks {
		tree.Notebooks[notebook.ID] = notebook
		tree.ChildrenByID[notebook.ParentID] = append(
			tree.ChildrenByID[notebook.ParentID],
			notebook,
		)
	}
	if _, ok := tree.Notebooks[rootID]; !ok {
		return notebookExportTree{}, errors.New("筆記本不存在")
	}
	for parentID := range tree.ChildrenByID {
		sort.SliceStable(tree.ChildrenByID[parentID], func(left int, right int) bool {
			items := tree.ChildrenByID[parentID]
			if items[left].SortOrder != items[right].SortOrder {
				return items[left].SortOrder < items[right].SortOrder
			}
			return strings.ToLower(items[left].Title) < strings.ToLower(items[right].Title)
		})
	}
	tree.FolderByID[rootID] = ""
	usedByParent := make(map[string]map[string]bool)
	var walk func(string, string) error
	walk = func(parentID string, parentPath string) error {
		used := usedByParent[parentID]
		if used == nil {
			used = make(map[string]bool)
			usedByParent[parentID] = used
		}
		if parentID == rootID {
			used["images"] = true
			used["resources"] = true
		}
		for _, child := range tree.ChildrenByID[parentID] {
			name := uniqueStem(safeExportName(child.Title, "未命名筆記本"), used)
			folder := filepath.ToSlash(filepath.Join(parentPath, name))
			tree.FolderByID[child.ID] = folder
			if err := walk(child.ID, folder); err != nil {
				return err
			}
		}
		return nil
	}
	if err := walk(rootID, ""); err != nil {
		return notebookExportTree{}, err
	}
	return tree, nil
}

func createNotebookExportFolders(destination string, tree notebookExportTree) error {
	for _, folder := range tree.FolderByID {
		if folder == "" {
			continue
		}
		if err := os.MkdirAll(filepath.Join(destination, filepath.FromSlash(folder)), 0o755); err != nil {
			return err
		}
	}
	return nil
}

func loadNotebookExportNotes(
	ctx context.Context,
	store *Store,
	tree notebookExportTree,
	rootID string,
) ([]Note, error) {
	notes := make([]Note, 0)
	offset := 0
	for {
		page, err := store.ListNotes(ctx, NoteQuery{
			View:          "notebook",
			NotebookID:    rootID,
			SortBy:        "title",
			SortDirection: "asc",
			Limit:         500,
			Offset:        offset,
		})
		if err != nil {
			return nil, err
		}
		for _, summary := range page.Items {
			if _, ok := tree.FolderByID[summary.NotebookID]; !ok {
				continue
			}
			note, err := store.GetNote(ctx, summary.ID)
			if err != nil {
				return nil, err
			}
			notes = append(notes, note)
		}
		offset += len(page.Items)
		if offset >= page.Total || len(page.Items) == 0 {
			break
		}
	}
	sort.SliceStable(notes, func(left int, right int) bool {
		leftFolder := tree.FolderByID[notes[left].NotebookID]
		rightFolder := tree.FolderByID[notes[right].NotebookID]
		if leftFolder != rightFolder {
			return strings.ToLower(leftFolder) < strings.ToLower(rightFolder)
		}
		if strings.ToLower(notes[left].Title) != strings.ToLower(notes[right].Title) {
			return strings.ToLower(notes[left].Title) < strings.ToLower(notes[right].Title)
		}
		return notes[left].ID < notes[right].ID
	})
	return notes, nil
}

func rewriteNotebookMarkdownResources(
	ctx context.Context,
	store *Store,
	note Note,
	noteFile string,
	writer *exportedResourceWriter,
) (string, error) {
	resourcesByID := make(map[string]Resource, len(note.Resources))
	resourcesByPath := make(map[string]Resource, len(note.Resources))
	for _, resource := range note.Resources {
		resourcesByID[resource.ID] = resource
		if resource.ExternalPath != "" {
			resourcesByPath[strings.ToLower(filepath.Clean(resource.ExternalPath))] = resource
		}
	}
	var rewriteErr error
	body := localResourceReferencePattern.ReplaceAllStringFunc(note.Body, func(value string) string {
		if rewriteErr != nil {
			return value
		}
		groups := localResourceReferencePattern.FindStringSubmatch(value)
		if len(groups) != 3 {
			return value
		}
		resource, ok := resourcesByID[groups[2]]
		if !ok {
			rewriteErr = fmt.Errorf("筆記「%s」找不到附件 %s", note.Title, groups[2])
			return value
		}
		replacement, err := writer.resourceMarkdownPath(ctx, store, noteFile, resource)
		if err != nil {
			rewriteErr = err
			return value
		}
		return groups[1] + replacement
	})
	if rewriteErr != nil {
		return "", rewriteErr
	}
	if note.StorageKind != storageKindDirectory || note.ExternalPath == "" {
		return body, nil
	}
	body = managedMarkdownResourcePattern.ReplaceAllStringFunc(body, func(match string) string {
		if rewriteErr != nil {
			return match
		}
		groups := managedMarkdownResourcePattern.FindStringSubmatch(match)
		if len(groups) < 3 {
			return match
		}
		target := groups[1]
		angleWrapped := target != ""
		if target == "" {
			target = groups[2]
		}
		absolutePath, ok := resolveManagedResourcePath(note.ExternalPath, target)
		if !ok {
			return match
		}
		resource, ok := resourcesByPath[strings.ToLower(filepath.Clean(absolutePath))]
		if !ok {
			return match
		}
		replacement, err := writer.resourceMarkdownPath(ctx, store, noteFile, resource)
		if err != nil {
			rewriteErr = err
			return match
		}
		oldDestination := target
		if angleWrapped {
			oldDestination = "<" + target + ">"
			replacement = "<" + replacement + ">"
		}
		return strings.Replace(match, oldDestination, replacement, 1)
	})
	return body, rewriteErr
}

func (w *exportedResourceWriter) resourceMarkdownPath(
	ctx context.Context,
	store *Store,
	noteFile string,
	resource Resource,
) (string, error) {
	relative, err := w.writeResource(ctx, store, resource)
	if err != nil {
		return "", err
	}
	if noteFile == "" {
		return "/" + relative, nil
	}
	target := filepath.Join(w.destinationRoot, filepath.FromSlash(relative))
	fromDirectory := filepath.Dir(noteFile)
	link, err := filepath.Rel(fromDirectory, target)
	if err != nil {
		return "", err
	}
	return (&url.URL{Path: filepath.ToSlash(link)}).EscapedPath(), nil
}

func (w *exportedResourceWriter) writeResource(
	ctx context.Context,
	store *Store,
	resource Resource,
) (string, error) {
	if existing := w.byResourceID[resource.ID]; existing != "" {
		return existing, nil
	}
	source := store.storedResourcePath(resource)
	if source == "" {
		return "", errors.New("附件路徑無效")
	}
	source, err := filepath.Abs(source)
	if err != nil {
		return "", err
	}
	sourceKey := strings.ToLower(filepath.Clean(source))
	if existing := w.bySourcePath[sourceKey]; existing != "" {
		w.byResourceID[resource.ID] = existing
		return existing, nil
	}
	info, err := os.Stat(source)
	if err != nil || !info.Mode().IsRegular() {
		return "", fmt.Errorf("無法讀取附件 %s", resource.Filename)
	}
	category := "resources"
	if strings.HasPrefix(strings.ToLower(resource.Mime), "image/") {
		category = "images"
	}
	categoryDirectory := filepath.Join(w.destinationRoot, category)
	if err := os.MkdirAll(categoryDirectory, 0o755); err != nil {
		return "", err
	}
	filename := normalizeResourceFilename(resource.Filename, resource.Title, resource.Mime, "")
	extension := filepath.Ext(filename)
	filename = uniqueExportFilename(
		categoryDirectory,
		safeExportName(strings.TrimSuffix(filename, extension), "attachment"),
		extension,
		w.usedNames,
	)
	target := filepath.Join(categoryDirectory, filename)
	relative := filepath.ToSlash(filepath.Join(category, filename))
	if !strings.EqualFold(filepath.Clean(source), filepath.Clean(target)) {
		if err := copyFile(source, target); err != nil {
			return "", fmt.Errorf("複製附件 %s 失敗: %w", resource.Filename, err)
		}
	}
	w.byResourceID[resource.ID] = relative
	w.bySourcePath[sourceKey] = relative
	return relative, nil
}

func inlineNotebookMarkdownResources(
	ctx context.Context,
	store *Store,
	note Note,
	body string,
	cache map[string]string,
) (string, error) {
	resourcesByID := make(map[string]Resource, len(note.Resources))
	resourcesByPath := make(map[string]Resource, len(note.Resources))
	for _, resource := range note.Resources {
		resourcesByID[resource.ID] = resource
		if resource.ExternalPath != "" {
			resourcesByPath[strings.ToLower(filepath.Clean(resource.ExternalPath))] = resource
		}
	}
	var replaceErr error
	body = localResourceReferencePattern.ReplaceAllStringFunc(body, func(value string) string {
		if replaceErr != nil {
			return value
		}
		groups := localResourceReferencePattern.FindStringSubmatch(value)
		if len(groups) != 3 {
			return value
		}
		resource, ok := resourcesByID[groups[2]]
		if !ok {
			replaceErr = fmt.Errorf("筆記「%s」找不到附件 %s", note.Title, groups[2])
			return value
		}
		dataURL, err := notebookResourceDataURL(store, resource, cache)
		if err != nil {
			replaceErr = err
			return value
		}
		return groups[1] + dataURL
	})
	if replaceErr != nil {
		return "", replaceErr
	}
	if note.StorageKind != storageKindDirectory || note.ExternalPath == "" {
		return body, nil
	}
	body = managedMarkdownResourcePattern.ReplaceAllStringFunc(body, func(match string) string {
		if replaceErr != nil {
			return match
		}
		groups := managedMarkdownResourcePattern.FindStringSubmatch(match)
		if len(groups) < 3 {
			return match
		}
		target := groups[1]
		angleWrapped := target != ""
		if target == "" {
			target = groups[2]
		}
		absolutePath, ok := resolveManagedResourcePath(note.ExternalPath, target)
		if !ok {
			return match
		}
		resource, ok := resourcesByPath[strings.ToLower(filepath.Clean(absolutePath))]
		if !ok {
			return match
		}
		dataURL, err := notebookResourceDataURL(store, resource, cache)
		if err != nil {
			replaceErr = err
			return match
		}
		oldDestination := target
		if angleWrapped {
			oldDestination = "<" + target + ">"
			dataURL = "<" + dataURL + ">"
		}
		return strings.Replace(match, oldDestination, dataURL, 1)
	})
	return body, replaceErr
}

func notebookResourceDataURL(store *Store, resource Resource, cache map[string]string) (string, error) {
	if existing := cache[resource.ID]; existing != "" {
		return existing, nil
	}
	path := store.storedResourcePath(resource)
	info, err := os.Stat(path)
	if err != nil || !info.Mode().IsRegular() {
		return "", fmt.Errorf("無法讀取附件 %s", resource.Filename)
	}
	if info.Size() > maxUploadFileBytes {
		return "", fmt.Errorf("附件 %s 超過 50 MB", resource.Filename)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	mimeType := resource.Mime
	if mimeType == "" {
		mimeType = detectMimeData(resource.Filename, data)
	}
	mimeType = strings.TrimSpace(strings.Split(mimeType, ";")[0])
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	value := "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data)
	cache[resource.ID] = value
	return value, nil
}

func uniqueExportFilename(
	directory string,
	stem string,
	extension string,
	used map[string]map[string]bool,
) string {
	key := strings.ToLower(filepath.Clean(directory))
	if used[key] == nil {
		used[key] = make(map[string]bool)
	}
	names := used[key]
	candidate := stem + extension
	for index := 2; ; index++ {
		lower := strings.ToLower(candidate)
		if !names[lower] {
			if _, err := os.Stat(filepath.Join(directory, candidate)); err != nil &&
				!errors.Is(err, os.ErrExist) {
				names[lower] = true
				return candidate
			}
		}
		candidate = fmt.Sprintf("%s (%d)%s", stem, index, extension)
	}
}

func uniqueStem(stem string, used map[string]bool) string {
	candidate := stem
	for index := 2; used[strings.ToLower(candidate)]; index++ {
		candidate = fmt.Sprintf("%s (%d)", stem, index)
	}
	used[strings.ToLower(candidate)] = true
	return candidate
}

func safeExportName(value string, fallback string) string {
	name := safeFilename(value)
	if name == "" {
		name = fallback
	}
	base := strings.TrimSuffix(name, filepath.Ext(name))
	if windowsReservedFilenames[strings.ToLower(base)] {
		name = "_" + name
	}
	return name
}

func ensureFileExtension(path string, extension string) string {
	if strings.EqualFold(filepath.Ext(path), extension) {
		return path
	}
	return path + extension
}

func escapeMarkdownInline(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "未命名筆記"
	}
	replacer := strings.NewReplacer(
		`\`, `\\`,
		`*`, `\*`,
		`_`, `\_`,
		`[`, `\[`,
		`]`, `\]`,
		`#`, `\#`,
	)
	return replacer.Replace(value)
}
