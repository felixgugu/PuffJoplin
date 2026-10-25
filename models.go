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
	ID            string     `json:"id"`
	NotebookID    string     `json:"notebookId"`
	StorageKind   string     `json:"storageKind"`
	ExternalPath  string     `json:"externalPath"`
	ExternalMTime int64      `json:"externalMTime"`
	ExternalSize  int64      `json:"externalSize"`
	Title         string     `json:"title"`
	Body          string     `json:"body"`
	IsTodo        bool       `json:"isTodo"`
	TodoDue       int64      `json:"todoDue"`
	TodoCompleted int64      `json:"todoCompleted"`
	SourceURL     string     `json:"sourceUrl"`
	Author        string     `json:"author"`
	IsConflict    bool       `json:"isConflict"`
	IsPinned      bool       `json:"isPinned"`
	CreatedAt     int64      `json:"createdAt"`
	UpdatedAt     int64      `json:"updatedAt"`
	DeletedAt     int64      `json:"deletedAt"`
	Tags          []string   `json:"tags"`
	Resources     []Resource `json:"resources"`
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

type NoteQuery struct {
	View          string `json:"view"`
	NotebookID    string `json:"notebookId"`
	TagID         string `json:"tagId"`
	Search        string `json:"search"`
	SortBy        string `json:"sortBy"`
	SortDirection string `json:"sortDirection"`
	Limit         int    `json:"limit"`
	Offset        int    `json:"offset"`
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

type ManagedDirectoryReport struct {
	NotebookID string          `json:"notebookId"`
	RootPath   string          `json:"rootPath"`
	Notebooks  int             `json:"notebooks"`
	Notes      int             `json:"notes"`
	Resources  int             `json:"resources"`
	Skipped    int             `json:"skipped"`
	Warnings   []ImportWarning `json:"warnings"`
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
