package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	noteInfoCompanyName     = "companyName"
	noteInfoDocumentNumber  = "documentNumber"
	noteInfoVersion         = "version"
	noteInfoClassification  = "classification"
	noteInfoDocumentTitle   = "documentTitle"
	noteInfoSubtitle        = "subtitle"
	noteInfoScope           = "scope"
	noteInfoPreparedByUnit  = "preparedByUnit"
	noteInfoPreparedBy      = "preparedBy"
	noteInfoSubmittedTo     = "submittedTo"
	noteInfoIssueDate       = "issueDate"
	noteInfoFooterText      = "footerText"
	noteInfoLabelMaxLength  = 30
	noteInfoValueMaxLength  = 200
	noteAdditionalInfoTable = "note_additional_info"
)

type noteInfoDefinition struct {
	Key           string
	DefaultLabel  string
	DefaultWeight int
}

var noteInfoDefinitions = []noteInfoDefinition{
	{Key: noteInfoCompanyName, DefaultLabel: "公司名稱", DefaultWeight: 600},
	{Key: noteInfoDocumentNumber, DefaultLabel: "文件編號", DefaultWeight: 400},
	{Key: noteInfoVersion, DefaultLabel: "版本", DefaultWeight: 400},
	{Key: noteInfoClassification, DefaultLabel: "機密等級", DefaultWeight: 400},
	{Key: noteInfoDocumentTitle, DefaultLabel: "文件標題", DefaultWeight: 700},
	{Key: noteInfoSubtitle, DefaultLabel: "副標題或專案名稱", DefaultWeight: 400},
	{Key: noteInfoScope, DefaultLabel: "適用範圍或報告期間", DefaultWeight: 400},
	{Key: noteInfoPreparedByUnit, DefaultLabel: "編製單位", DefaultWeight: 400},
	{Key: noteInfoPreparedBy, DefaultLabel: "編製人員", DefaultWeight: 400},
	{Key: noteInfoSubmittedTo, DefaultLabel: "提交對象", DefaultWeight: 400},
	{Key: noteInfoIssueDate, DefaultLabel: "發行日期", DefaultWeight: 400},
	{Key: noteInfoFooterText, DefaultLabel: "頁尾文字", DefaultWeight: 400},
}

func defaultNoteInfoFields() []NoteInfoField {
	fields := make([]NoteInfoField, 0, len(noteInfoDefinitions))
	for _, definition := range noteInfoDefinitions {
		fields = append(fields, NoteInfoField{
			Key:   definition.Key,
			Label: definition.DefaultLabel,
		})
	}
	return fields
}

func noteInfoDefinitionFor(key string) (noteInfoDefinition, bool) {
	for _, definition := range noteInfoDefinitions {
		if definition.Key == key {
			return definition, true
		}
	}
	return noteInfoDefinition{}, false
}

func normalizeNoteInfoFields(fields []NoteInfoField) []NoteInfoField {
	byKey := make(map[string]NoteInfoField, len(fields))
	for _, field := range fields {
		key := strings.TrimSpace(field.Key)
		if _, exists := noteInfoDefinitionFor(key); !exists {
			continue
		}
		byKey[key] = field
	}
	normalized := make([]NoteInfoField, 0, len(noteInfoDefinitions))
	for _, definition := range noteInfoDefinitions {
		field := byKey[definition.Key]
		label := sanitizeNoteInfoText(field.Label, noteInfoLabelMaxLength)
		if label == "" {
			label = definition.DefaultLabel
		}
		normalized = append(normalized, NoteInfoField{
			Key:   definition.Key,
			Label: label,
			Value: sanitizeNoteInfoText(field.Value, noteInfoValueMaxLength),
		})
	}
	return normalized
}

func sanitizeNoteInfoText(value string, maxLength int) string {
	value = strings.Map(func(character rune) rune {
		if character < 0x20 || character == 0x7f {
			return ' '
		}
		return character
	}, value)
	value = strings.Join(strings.Fields(value), " ")
	runes := []rune(value)
	if len(runes) > maxLength {
		runes = runes[:maxLength]
	}
	return string(runes)
}

func (s *Store) NoteAdditionalInfo(
	ctx context.Context,
	noteID string,
) ([]NoteInfoField, error) {
	var raw string
	err := s.db.QueryRowContext(
		ctx,
		`SELECT fields_json FROM `+noteAdditionalInfoTable+` WHERE note_id = ?`,
		noteID,
	).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return defaultNoteInfoFields(), nil
	}
	if err != nil {
		return nil, fmt.Errorf("讀取筆記附加資訊: %w", err)
	}
	var fields []NoteInfoField
	if err := json.Unmarshal([]byte(raw), &fields); err != nil {
		return defaultNoteInfoFields(), nil
	}
	return normalizeNoteInfoFields(fields), nil
}

func (s *Store) SetNoteAdditionalInfo(
	ctx context.Context,
	noteID string,
	fields []NoteInfoField,
) ([]NoteInfoField, error) {
	noteID = strings.TrimSpace(noteID)
	if noteID == "" {
		return nil, errors.New("缺少筆記 ID")
	}
	var exists int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM notes WHERE id = ?`, noteID).Scan(&exists); err != nil {
		return nil, err
	}
	if exists == 0 {
		return nil, errors.New("筆記不存在")
	}
	normalized := normalizeNoteInfoFields(fields)
	data, err := json.Marshal(normalized)
	if err != nil {
		return nil, err
	}
	now := time.Now().UnixMilli()
	if _, err := s.db.ExecContext(
		ctx,
		`INSERT INTO `+noteAdditionalInfoTable+`(note_id, fields_json, updated_at)
		 VALUES(?, ?, ?)
		 ON CONFLICT(note_id) DO UPDATE SET
		   fields_json = excluded.fields_json,
		   updated_at = excluded.updated_at`,
		noteID,
		string(data),
		now,
	); err != nil {
		return nil, fmt.Errorf("儲存筆記附加資訊: %w", err)
	}
	return normalized, nil
}
