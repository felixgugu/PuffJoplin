package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type managedRootWatcher struct {
	rootID     string
	rootPath   string
	exclusions ManagedDirectoryExclusions
	watcher    *fsnotify.Watcher
	stop       chan struct{}
	done       chan struct{}
}

func (a *App) startManagedWatchers() {
	roots, err := a.store.ListManagedRoots(a.ctx)
	if err != nil {
		a.logger.Printf("list managed directories: %v", err)
		return
	}
	for _, root := range roots {
		if report, refreshErr := a.store.RefreshManagedDirectory(a.ctx, root.ID); refreshErr != nil {
			a.logger.Printf("refresh managed directory %s: %v", root.StorageRoot, refreshErr)
		} else if report.Skipped > 0 {
			a.logger.Printf("managed directory %s skipped %d item(s)", root.StorageRoot, report.Skipped)
		}
		a.startManagedWatcher(root.ID, root.StorageRoot)
	}
}

func (a *App) startManagedWatcher(rootID string, rootPath string) {
	exclusions, err := a.store.GetManagedDirectoryExclusions(a.ctx)
	if err != nil {
		a.logger.Printf("read exclusions for managed directory %s: %v", rootPath, err)
		return
	}
	a.managedMu.Lock()
	if _, exists := a.managedWatchers[rootID]; exists {
		a.managedMu.Unlock()
		return
	}
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		a.managedMu.Unlock()
		a.logger.Printf("create watcher for %s: %v", rootPath, err)
		return
	}
	if err := addManagedWatchTree(watcher, rootPath, exclusions); err != nil {
		_ = watcher.Close()
		a.managedMu.Unlock()
		a.logger.Printf("watch managed directory %s: %v", rootPath, err)
		return
	}
	item := &managedRootWatcher{
		rootID: rootID, rootPath: rootPath, exclusions: exclusions, watcher: watcher,
		stop: make(chan struct{}), done: make(chan struct{}),
	}
	a.managedWatchers[rootID] = item
	a.managedMu.Unlock()
	go a.runManagedWatcher(item)
}

func addManagedWatchTree(
	watcher *fsnotify.Watcher,
	root string,
	exclusions ManagedDirectoryExclusions,
) error {
	return filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			if path == root {
				return err
			}
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if !entry.IsDir() {
			return nil
		}
		if managedPathExcluded(root, path, true, exclusions) {
			return filepath.SkipDir
		}
		if path != root && strings.EqualFold(entry.Name(), managedImagesDir) {
			return filepath.SkipDir
		}
		if err := watcher.Add(path); err != nil && !errors.Is(err, fsnotify.ErrClosed) {
			return err
		}
		return nil
	})
}

func (a *App) runManagedWatcher(item *managedRootWatcher) {
	defer close(item.done)
	var timer *time.Timer
	var timerChannel <-chan time.Time
	refresh := func() {
		report, err := a.store.RefreshManagedDirectory(a.ctx, item.rootID)
		if err != nil {
			a.logger.Printf("refresh managed directory %s: %v", item.rootPath, err)
			return
		}
		runtime.EventsEmit(a.ctx, "notebooks.changed", item.rootID)
		runtime.EventsEmit(a.ctx, "notes.changed", "")
		runtime.EventsEmit(a.ctx, "managedDirectory.refreshed", report)
	}
	for {
		select {
		case <-item.stop:
			if timer != nil {
				timer.Stop()
			}
			_ = item.watcher.Close()
			return
		case event, ok := <-item.watcher.Events:
			if !ok {
				return
			}
			if managedPathExcluded(item.rootPath, event.Name, true, item.exclusions) ||
				managedPathExcluded(item.rootPath, event.Name, false, item.exclusions) {
				continue
			}
			if event.Op&fsnotify.Create != 0 {
				if info, err := os.Stat(event.Name); err == nil && info.IsDir() &&
					!strings.EqualFold(filepath.Base(event.Name), managedImagesDir) {
					_ = addManagedWatchTree(item.watcher, event.Name, item.exclusions)
				}
			}
			if !managedWatchEventRelevant(event) {
				continue
			}
			if timer == nil {
				timer = time.NewTimer(300 * time.Millisecond)
			} else {
				if !timer.Stop() {
					select {
					case <-timer.C:
					default:
					}
				}
				timer.Reset(300 * time.Millisecond)
			}
			timerChannel = timer.C
		case <-timerChannel:
			timerChannel = nil
			refresh()
		case err, ok := <-item.watcher.Errors:
			if ok && err != nil {
				a.logger.Printf("managed directory watcher %s: %v", item.rootPath, err)
			}
		}
	}
}

func managedWatchEventRelevant(event fsnotify.Event) bool {
	extension := strings.ToLower(filepath.Ext(event.Name))
	if extension == ".md" {
		return true
	}
	if event.Op&(fsnotify.Create|fsnotify.Remove|fsnotify.Rename) != 0 {
		if info, err := os.Stat(event.Name); err == nil {
			return info.IsDir()
		}
		return true
	}
	return false
}

func (a *App) stopManagedWatcher(rootID string) {
	a.managedMu.Lock()
	item := a.managedWatchers[rootID]
	delete(a.managedWatchers, rootID)
	a.managedMu.Unlock()
	if item == nil {
		return
	}
	close(item.stop)
	<-item.done
}

func (a *App) stopManagedWatchers() {
	a.managedMu.Lock()
	items := make([]*managedRootWatcher, 0, len(a.managedWatchers))
	for rootID, item := range a.managedWatchers {
		items = append(items, item)
		delete(a.managedWatchers, rootID)
	}
	a.managedMu.Unlock()
	for _, item := range items {
		close(item.stop)
		<-item.done
	}
}

func (a *App) OpenManagedMarkdownNotebook() (ManagedDirectoryReport, error) {
	store, err := a.readyStore()
	if err != nil {
		return ManagedDirectoryReport{}, err
	}
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                "開啟 Markdown 筆記目錄",
		CanCreateDirectories: false,
	})
	if err != nil || path == "" {
		return ManagedDirectoryReport{}, err
	}
	report, err := store.RegisterManagedDirectory(a.ctx, path)
	if err != nil {
		return ManagedDirectoryReport{}, err
	}
	root, err := store.getNotebook(a.ctx, report.NotebookID)
	if err != nil {
		return ManagedDirectoryReport{}, err
	}
	a.startManagedWatcher(root.ID, root.StorageRoot)
	runtime.EventsEmit(a.ctx, "notebooks.changed", root.ID)
	runtime.EventsEmit(a.ctx, "notes.changed", "")
	return report, nil
}

func (a *App) RefreshManagedNotebook(notebookID string) (ManagedDirectoryReport, error) {
	store, err := a.readyStore()
	if err != nil {
		return ManagedDirectoryReport{}, err
	}
	report, err := store.RefreshManagedDirectory(a.ctx, notebookID)
	if err == nil {
		runtime.EventsEmit(a.ctx, "notebooks.changed", report.NotebookID)
		runtime.EventsEmit(a.ctx, "notes.changed", "")
	}
	return report, err
}

func (a *App) revealNotebookDirectory(notebook Notebook) error {
	if notebook.StorageKind != storageKindDirectory {
		return errors.New("此筆記本沒有實體資料夾")
	}
	path := managedNotebookDirectory(notebook)
	if info, err := os.Stat(path); err != nil || !info.IsDir() {
		return errors.New("筆記本資料夾目前無法存取")
	}
	return exec.Command("explorer.exe", path).Start()
}

func (a *App) RevealNotebook(notebookID string) error {
	store, err := a.readyStore()
	if err != nil {
		return err
	}
	notebook, err := store.getNotebook(a.ctx, notebookID)
	if err != nil {
		return errors.New("筆記本不存在")
	}
	return a.revealNotebookDirectory(notebook)
}
