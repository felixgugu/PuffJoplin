package main

type BootstrapState struct {
	Status             string `json:"status"`
	AppVersion         string `json:"appVersion"`
	DataDir            string `json:"dataDir"`
	UploadToken        string `json:"uploadToken"`
	NoteCount          int    `json:"noteCount"`
	NotebookCount      int    `json:"notebookCount"`
	JoplinProfile      string `json:"joplinProfile"`
	CanImportJoplin    bool   `json:"canImportJoplin"`
	OnboardingStatus   string `json:"onboardingStatus"`
	OnboardingRequired bool   `json:"onboardingRequired"`
	Message            string `json:"message"`
}

type JoplinProfilePreview struct {
	Available      bool   `json:"available"`
	ProfilePath    string `json:"profilePath"`
	DisplayName    string `json:"displayName"`
	Notes          int    `json:"notes"`
	Notebooks      int    `json:"notebooks"`
	Resources      int    `json:"resources"`
	EncryptedNotes int    `json:"encryptedNotes"`
	Error          string `json:"error"`
}

type Notebook struct {
	ID          string `json:"id"`
	ParentID    string `json:"parentId"`
	Title       string `json:"title"`
	Icon        string `json:"icon"`
	SortOrder   int    `json:"sortOrder"`
	StorageKind string `json:"storageKind"`
	StorageRoot string `json:"storageRoot"`
	StoragePath string `json:"storagePath"`
	CreatedAt   int64  `json:"createdAt"`
	UpdatedAt   int64  `json:"updatedAt"`
}

type Tag struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Count int    `json:"count"`
}

type NoteSummary struct {
	ID              string   `json:"id"`
	NotebookID      string   `json:"notebookId"`
	NotebookTitle   string   `json:"notebookTitle"`
	Title           string   `json:"title"`
	Snippet         string   `json:"snippet"`
	IsTodo          bool     `json:"isTodo"`
	TodoDue         int64    `json:"todoDue"`
	TodoCompleted   int64    `json:"todoCompleted"`
	IsConflict      bool     `json:"isConflict"`
	IsPinned        bool     `json:"isPinned"`
	CreatedAt       int64    `json:"createdAt"`
	UpdatedAt       int64    `json:"updatedAt"`
	DeletedAt       int64    `json:"deletedAt"`
	Tags            []string `json:"tags"`
	AttachmentCount int      `json:"attachmentCount"`
	StorageKind     string   `json:"storageKind"`
}

type Note struct {
	ID             string          `json:"id"`
	NotebookID     string          `json:"notebookId"`
	StorageKind    string          `json:"storageKind"`
	ExternalPath   string          `json:"externalPath"`
	ExternalMTime  int64           `json:"externalMTime"`
	ExternalSize   int64           `json:"externalSize"`
	Title          string          `json:"title"`
	Body           string          `json:"body"`
	IsTodo         bool            `json:"isTodo"`
	TodoDue        int64           `json:"todoDue"`
	TodoCompleted  int64           `json:"todoCompleted"`
	SourceURL      string          `json:"sourceUrl"`
	Author         string          `json:"author"`
	IsConflict     bool            `json:"isConflict"`
	IsPinned       bool            `json:"isPinned"`
	CreatedAt      int64           `json:"createdAt"`
	UpdatedAt      int64           `json:"updatedAt"`
	DeletedAt      int64           `json:"deletedAt"`
	Tags           []string        `json:"tags"`
	Resources      []Resource      `json:"resources"`
	AdditionalInfo []NoteInfoField `json:"additionalInfo"`
}

type NoteInput struct {
	ID            string `json:"id"`
	NotebookID    string `json:"notebookId"`
	Title         string `json:"title"`
	Body          string `json:"body"`
	IsTodo        bool   `json:"isTodo"`
	TodoDue       int64  `json:"todoDue"`
	TodoCompleted int64  `json:"todoCompleted"`
	SourceURL     string `json:"sourceUrl"`
	Author        string `json:"author"`
}

type NoteInfoField struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Value string `json:"value"`
}

type NoteQuery struct {
	View                string `json:"view"`
	NotebookID          string `json:"notebookId"`
	TagID               string `json:"tagId"`
	TodoStatus          string `json:"todoStatus"`
	Search              string `json:"search"`
	SearchField         string `json:"searchField"`
	SearchCaseSensitive bool   `json:"searchCaseSensitive"`
	SearchWholeWord     bool   `json:"searchWholeWord"`
	SortBy              string `json:"sortBy"`
	SortDirection       string `json:"sortDirection"`
	Limit               int    `json:"limit"`
	Offset              int    `json:"offset"`
}

type NotePage struct {
	Items []NoteSummary `json:"items"`
	Total int           `json:"total"`
}

type Resource struct {
	ID           string `json:"id"`
	NoteID       string `json:"noteId"`
	Title        string `json:"title"`
	Mime         string `json:"mime"`
	Filename     string `json:"filename"`
	FileSize     int64  `json:"fileSize"`
	URL          string `json:"url"`
	StorageKind  string `json:"storageKind"`
	ExternalPath string `json:"externalPath"`
	StoragePath  string `json:"storagePath"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}

type ResourceCleanupReport struct {
	RemovedCount   int   `json:"removedCount"`
	RemovedIndexed int   `json:"removedIndexed"`
	RemovedOrphans int   `json:"removedOrphans"`
	FreedBytes     int64 `json:"freedBytes"`
	FailedCount    int   `json:"failedCount"`
	SkippedRecent  int   `json:"skippedRecent"`
}

type DashboardCounts struct {
	ActiveNotes    int `json:"activeNotes"`
	TrashNotes     int `json:"trashNotes"`
	Notebooks      int `json:"notebooks"`
	Tags           int `json:"tags"`
	OpenTodos      int `json:"openTodos"`
	CompletedTodos int `json:"completedTodos"`
}

type DashboardTodo struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	NotebookTitle string `json:"notebookTitle"`
	TodoDue       int64  `json:"todoDue"`
}

type DashboardRecentNote struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	NotebookTitle string `json:"notebookTitle"`
	UpdatedAt     int64  `json:"updatedAt"`
}

type DashboardActivityDay struct {
	Date    string `json:"date"`
	Created int    `json:"created"`
	Updated int    `json:"updated"`
}

type DashboardNotebookStat struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	NoteCount     int    `json:"noteCount"`
	OpenTodoCount int    `json:"openTodoCount"`
	StorageKind   string `json:"storageKind"`
}

type DashboardMedia struct {
	ImageReferences      int   `json:"imageReferences"`
	MermaidDiagrams      int   `json:"mermaidDiagrams"`
	AttachmentCount      int   `json:"attachmentCount"`
	AttachmentBytes      int64 `json:"attachmentBytes"`
	UnusedResourceCount  int   `json:"unusedResourceCount"`
	UnusedResourceBytes  int64 `json:"unusedResourceBytes"`
	MissingResourceCount int   `json:"missingResourceCount"`
}

type DashboardManagedRoot struct {
	NotebookID string `json:"notebookId"`
	Title      string `json:"title"`
	Path       string `json:"path"`
	Available  bool   `json:"available"`
}

type DashboardHealth struct {
	DataDir      string                 `json:"dataDir"`
	ManagedRoots []DashboardManagedRoot `json:"managedRoots"`
}

type DashboardSnapshot struct {
	Counts      DashboardCounts         `json:"counts"`
	Todos       []DashboardTodo         `json:"todos"`
	Recent      []DashboardRecentNote   `json:"recent"`
	Activity    []DashboardActivityDay  `json:"activity"`
	Notebooks   []DashboardNotebookStat `json:"notebooks"`
	Tags        []Tag                   `json:"tags"`
	Media       DashboardMedia          `json:"media"`
	Health      DashboardHealth         `json:"health"`
	GeneratedAt int64                   `json:"generatedAt"`
}

type ManagedDirectoryReport struct {
	NotebookID string          `json:"notebookId"`
	RootPath   string          `json:"rootPath"`
	Notebooks  int             `json:"notebooks"`
	Notes      int             `json:"notes"`
	Resources  int             `json:"resources"`
	Skipped    int             `json:"skipped"`
	Warnings   []ImportWarning `json:"warnings"`
}

type ManagedDirectoryExclusions struct {
	FolderNames       []string `json:"folderNames"`
	MarkdownFileNames []string `json:"markdownFileNames"`
}

type ManagedDirectoryExclusionReport struct {
	Exclusions        ManagedDirectoryExclusions `json:"exclusions"`
	RootCount         int                        `json:"rootCount"`
	HiddenNotebooks   int                        `json:"hiddenNotebooks"`
	HiddenNotes       int                        `json:"hiddenNotes"`
	RestoredNotebooks int                        `json:"restoredNotebooks"`
	RestoredNotes     int                        `json:"restoredNotes"`
	HiddenNoteIDs     []string                   `json:"hiddenNoteIds"`
	Warnings          []ImportWarning            `json:"warnings"`
}

type ImportRequest struct {
	SourcePath string `json:"sourcePath"`
}

type ImportWarning struct {
	Item    string `json:"item"`
	Message string `json:"message"`
}

type ImportReport struct {
	Source            string          `json:"source"`
	Kind              string          `json:"kind"`
	Notebooks         int             `json:"notebooks"`
	Notes             int             `json:"notes"`
	Tags              int             `json:"tags"`
	Resources         int             `json:"resources"`
	Skipped           int             `json:"skipped"`
	Warnings          []ImportWarning `json:"warnings"`
	EncryptedSkipped  []string        `json:"encryptedSkipped"`
	DestinationFolder string          `json:"destinationFolder"`
}

type NoteExportRequest struct {
	NoteID string `json:"noteId"`
	Format string `json:"format"`
	HTML   string `json:"html"`
}

type NoteDocxExport struct {
	Path            string `json:"path"`
	DefaultFilename string `json:"defaultFilename"`
	Markdown        string `json:"markdown"`
}

type NotebookDocxExport struct {
	Path            string `json:"path"`
	DefaultFilename string `json:"defaultFilename"`
	Markdown        string `json:"markdown"`
}
