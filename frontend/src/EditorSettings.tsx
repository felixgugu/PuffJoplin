import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import FluentSelect from './FluentSelect';
import {
  DEFAULT_SOURCE_FONT_FAMILY,
  normalizeSourceColor,
  normalizeSourceFontFamily,
  SOURCE_FONT_PRESETS,
  sourceColorCSSVariables,
  sourceTypographyCSSVariables,
  type EditorPreferences,
  type SourceEditorProfile,
  type SourceEditorTypography,
} from './editorPreferences';
import type { EditorMode } from './editorTabs';

interface EditorSettingsProps {
  preferences: EditorPreferences;
  theme: 'light' | 'dark';
  hidden: boolean;
  onChange: (preferences: EditorPreferences) => void;
  onReset: () => void;
}

interface ColorFieldProps {
  disabled: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const colorFields: Array<{
  key: keyof Pick<
    SourceEditorProfile,
    | 'foreground'
    | 'background'
    | 'caretColor'
    | 'gutterColor'
    | 'heading'
    | 'strong'
    | 'emphasis'
    | 'link'
    | 'code'
    | 'inlineCode'
    | 'inlineCodeBackground'
    | 'codeBlockBackground'
    | 'quote'
    | 'meta'
    | 'list'
    | 'string'
  >;
  label: string;
  group: 'basic' | 'syntax';
}> = [
  { key: 'foreground', label: '前景', group: 'basic' },
  { key: 'background', label: '背景', group: 'basic' },
  { key: 'caretColor', label: '游標', group: 'basic' },
  { key: 'gutterColor', label: '行號與折疊控制', group: 'basic' },
  { key: 'heading', label: '標題', group: 'syntax' },
  { key: 'strong', label: '粗體', group: 'syntax' },
  { key: 'emphasis', label: '斜體', group: 'syntax' },
  { key: 'link', label: '連結', group: 'syntax' },
  { key: 'code', label: '區塊程式碼文字', group: 'syntax' },
  { key: 'codeBlockBackground', label: '程式碼區塊背景', group: 'syntax' },
  { key: 'inlineCode', label: '行內程式碼文字', group: 'syntax' },
  { key: 'inlineCodeBackground', label: '行內程式碼背景', group: 'syntax' },
  { key: 'quote', label: '引用', group: 'syntax' },
  { key: 'meta', label: 'Markdown 標記', group: 'syntax' },
  { key: 'list', label: '清單', group: 'syntax' },
  { key: 'string', label: '字串', group: 'syntax' },
];

function ColorField({
  disabled,
  label,
  value,
  onChange,
}: ColorFieldProps) {
  const pendingColorRef = useRef(value);
  const colorTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (colorTimerRef.current !== null) window.clearTimeout(colorTimerRef.current);
  }, []);

  const commit = (input: HTMLInputElement) => {
    const normalized = normalizeSourceColor(input.value);
    if (!normalized) {
      input.value = value;
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    input.removeAttribute('aria-invalid');
    input.value = normalized;
    if (colorTimerRef.current !== null) {
      window.clearTimeout(colorTimerRef.current);
      colorTimerRef.current = null;
    }
    pendingColorRef.current = normalized;
    onChange(normalized);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(event.currentTarget);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.currentTarget.value = value;
      event.currentTarget.removeAttribute('aria-invalid');
    }
  };

  return (
    <label className="source-color-field">
      <span>{label}</span>
      <div>
        <input
          type="color"
          value={value}
          disabled={disabled}
          aria-label={`${label}色票`}
          onChange={(event) => {
            const normalized = normalizeSourceColor(event.target.value) ?? value;
            pendingColorRef.current = normalized;
            if (colorTimerRef.current !== null) return;
            colorTimerRef.current = window.setTimeout(() => {
              colorTimerRef.current = null;
              onChange(pendingColorRef.current);
            }, 40);
          }}
        />
        <input
          key={value}
          type="text"
          defaultValue={value}
          disabled={disabled}
          aria-label={`${label}色碼`}
          spellCheck={false}
          onBlur={(event) => commit(event.currentTarget)}
          onKeyDown={onKeyDown}
        />
      </div>
    </label>
  );
}

export default function EditorSettings({
  preferences,
  theme,
  hidden,
  onChange,
  onReset,
}: EditorSettingsProps) {
  const [scheme, setScheme] = useState<'light' | 'dark'>(theme);
  const profile = preferences.sourceAppearance[scheme];
  const sourceFontFamily = preferences.sourceTypography.fontFamily;
  const sourceFontIsPreset = SOURCE_FONT_PRESETS.some(
    (preset) => preset.value === sourceFontFamily,
  );
  const [customSourceFontSelected, setCustomSourceFontSelected] = useState(
    !sourceFontIsPreset,
  );
  const [customSourceFontDraft, setCustomSourceFontDraft] = useState(sourceFontFamily);
  const previewTypography = customSourceFontSelected
    ? {
        ...preferences.sourceTypography,
        fontFamily: normalizeSourceFontFamily(customSourceFontDraft),
      }
    : preferences.sourceTypography;
  const previewStyle = {
    ...sourceTypographyCSSVariables(previewTypography),
    ...sourceColorCSSVariables(profile),
  } as CSSProperties;

  useEffect(() => {
    setScheme(theme);
  }, [theme]);

  useEffect(() => {
    setCustomSourceFontSelected(
      !SOURCE_FONT_PRESETS.some((preset) => preset.value === sourceFontFamily),
    );
    setCustomSourceFontDraft(sourceFontFamily);
  }, [sourceFontFamily]);

  const updateSourceTypography = (changes: Partial<SourceEditorTypography>) => {
    onChange({
      ...preferences,
      sourceTypography: {
        ...preferences.sourceTypography,
        ...changes,
      },
    });
  };

  const updateProfile = (changes: Partial<SourceEditorProfile>) => {
    onChange({
      ...preferences,
      sourceAppearance: {
        ...preferences.sourceAppearance,
        [scheme]: {
          ...profile,
          ...changes,
        },
      },
    });
  };

  const renderColorGroup = (group: 'basic' | 'syntax') => (
    <div className="source-color-grid">
      {colorFields
        .filter((field) => field.group === group)
        .map((field) => (
          <ColorField
            key={field.key}
            disabled={!preferences.customSourceAppearance}
            label={field.label}
            value={profile[field.key]}
            onChange={(value) => updateProfile({ [field.key]: value })}
          />
        ))}
    </div>
  );

  return (
    <section
      id="settings-panel-editor"
      className="settings-editor"
      role="tabpanel"
      aria-labelledby="settings-tab-editor"
      tabIndex={0}
      hidden={hidden}
    >
      <div className="settings-section-heading">
        <div>
          <strong id="editor-settings-heading">編輯器</strong>
          <span>設定新筆記的預設模式與 CodeMirror 原始碼外觀。</span>
        </div>
        <button type="button" onClick={onReset}>恢復預設</button>
      </div>

      <section className="settings-editor-section" aria-labelledby="editor-general-heading">
        <div className="settings-section-heading">
          <div>
            <strong id="editor-general-heading">一般</strong>
            <span>預設模式只影響沒有既有模式紀錄的新分頁。</span>
          </div>
        </div>
        <div className="settings-editor-general">
          <label className="appearance-field">
            <span>預設編輯模式</span>
            <FluentSelect<EditorMode>
              value={preferences.defaultMode}
              options={[
                { value: 'sv', label: '原始碼' },
                { value: 'ir', label: '即時渲染' },
                { value: 'wysiwyg', label: '所見即所得' },
              ]}
              ariaLabel="預設編輯模式"
              onChange={(value) => onChange({
                ...preferences,
                defaultMode: value,
              })}
            />
            <small>已開啟或曾使用過的分頁會保留各自模式。</small>
          </label>
          <div className="appearance-field source-lines-field">
            <span>原始碼行號</span>
            <label className="appearance-toggle">
              <input
                type="checkbox"
                checked={preferences.showSourceLineNumbers}
                onChange={(event) => onChange({
                  ...preferences,
                  showSourceLineNumbers: event.target.checked,
                })}
              />
              <span className="appearance-toggle-track" aria-hidden="true" />
              <span>在原始碼模式顯示行號與折疊控制</span>
            </label>
          </div>
          <div className="appearance-field source-wrap-field">
            <span>自動換行</span>
            <label className="appearance-toggle">
              <input
                type="checkbox"
                checked={preferences.sourceWordWrap}
                onChange={(event) => onChange({
                  ...preferences,
                  sourceWordWrap: event.target.checked,
                })}
              />
              <span className="appearance-toggle-track" aria-hidden="true" />
              <span>原始碼超出編輯區寬度時自動換行</span>
            </label>
          </div>
        </div>
      </section>

      <section className="settings-editor-section" aria-labelledby="source-appearance-heading">
        <div className="settings-section-heading">
          <div>
            <strong id="source-appearance-heading">原始碼外觀</strong>
            <span>設定共用的 CodeMirror 字型，並分別保存亮色與暗色語法配色。</span>
          </div>
        </div>

        <fieldset className="source-appearance-controls source-typography-controls">
          <legend>字型</legend>
          <div className="source-font-family-control">
            <label className="appearance-field">
              <span>字型家族</span>
              <FluentSelect
                value={customSourceFontSelected ? '__custom' : sourceFontFamily}
                options={[
                  ...SOURCE_FONT_PRESETS.map((preset) => ({
                    value: preset.value,
                    label: preset.label,
                  })),
                  { value: '__custom', label: '自訂字型…' },
                ]}
                ariaLabel="原始碼字型家族"
                onChange={(value) => {
                  if (value === '__custom') {
                    setCustomSourceFontSelected(true);
                    return;
                  }
                  setCustomSourceFontSelected(false);
                  setCustomSourceFontDraft(value);
                  updateSourceTypography({ fontFamily: value });
                }}
              />
              <small>字型會套用到 Markdown 原始碼編輯器與上方預覽。</small>
            </label>
            {customSourceFontSelected && (
              <label className="appearance-field custom-source-font-field">
                <span>自訂字型名稱</span>
                <input
                  type="text"
                  value={customSourceFontDraft}
                  spellCheck={false}
                  placeholder="例如：JetBrains Mono"
                  onChange={(event) => {
                    setCustomSourceFontDraft(event.target.value);
                  }}
                  onBlur={() => {
                    const normalized = normalizeSourceFontFamily(customSourceFontDraft);
                    setCustomSourceFontDraft(normalized);
                    updateSourceTypography({ fontFamily: normalized });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      setCustomSourceFontDraft(sourceFontFamily);
                    }
                  }}
                />
                <small>
                  必須是系統已安裝的字型；找不到時會使用
                  {' '}
                  {DEFAULT_SOURCE_FONT_FAMILY}
                  {' '}
                  等等寬 fallback。
                </small>
              </label>
            )}
          </div>
          <div className="source-number-grid">
            <label>
              <span>文字字重</span>
              <FluentSelect
                value={String(preferences.sourceTypography.fontWeight)}
                options={[300, 400, 500, 600, 700, 800].map((weight) => ({
                  value: String(weight),
                  label: String(weight),
                }))}
                ariaLabel="原始碼文字字重"
                onChange={(next) => updateSourceTypography({ fontWeight: Number(next) })}
              />
            </label>
            <label>
              <span>
                字級倍率
                {' '}
                <small>{preferences.sourceTypography.fontScale.toFixed(2)}×</small>
              </span>
              <input
                type="range"
                min={0.8}
                max={1.8}
                step={0.05}
                value={preferences.sourceTypography.fontScale}
                onChange={(event) => updateSourceTypography({
                  fontScale: Number(event.target.value),
                })}
              />
            </label>
            <label>
              <span>
                行高
                {' '}
                <small>{preferences.sourceTypography.lineHeight.toFixed(2)}</small>
              </span>
              <input
                type="range"
                min={1.2}
                max={2.2}
                step={0.05}
                value={preferences.sourceTypography.lineHeight}
                onChange={(event) => updateSourceTypography({
                  lineHeight: Number(event.target.value),
                })}
              />
            </label>
          </div>
        </fieldset>

        <div className="source-color-custom-heading">
          <div>
            <strong>原始碼配色</strong>
            <span>自訂亮色與暗色佈景使用的 CodeMirror 顏色。</span>
          </div>
          <label className="appearance-toggle">
            <input
              type="checkbox"
              checked={preferences.customSourceAppearance}
              onChange={(event) => onChange({
                ...preferences,
                customSourceAppearance: event.target.checked,
              })}
            />
            <span className="appearance-toggle-track" aria-hidden="true" />
            <span>使用自訂原始碼配色</span>
          </label>
        </div>

        <div className="source-appearance-scheme-tabs" role="tablist" aria-label="原始碼配色佈景">
          {(['light', 'dark'] as const).map((value) => (
            <button
              type="button"
              role="tab"
              key={value}
              className={scheme === value ? 'active' : ''}
              aria-selected={scheme === value}
              onClick={() => setScheme(value)}
            >
              {value === 'light' ? '亮色配色' : '暗色配色'}
            </button>
          ))}
        </div>

        <div className="source-appearance-preview" style={previewStyle} aria-label="原始碼配色預覽">
          <span className="source-preview-label">原始碼預覽</span>
          <div className="source-preview-heading"># 章節標題</div>
          <p>
            <strong>粗體文字</strong>、<em>斜體文字</em>與
            <span className="source-preview-link"> 連結文字</span>
          </p>
          <blockquote>引用段落</blockquote>
          <ul>
            <li>清單項目與 <code>`inline code`</code></li>
          </ul>
          <pre className="source-preview-code-block"><code>const answer = 42;</code></pre>
          <span className="source-preview-marker">**Markdown 標記**</span>
        </div>

        <fieldset
          className="source-appearance-controls"
          disabled={!preferences.customSourceAppearance}
        >
          <legend>基礎配色</legend>
          {renderColorGroup('basic')}
          <div className="source-number-grid">
            <label>
              <span>游標寬度 <small>{profile.caretWidth} px</small></span>
              <input
                type="range"
                min={1}
                max={3}
                step={1}
                value={profile.caretWidth}
                onChange={(event) => updateProfile({ caretWidth: Number(event.target.value) })}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="source-appearance-controls" disabled={!preferences.customSourceAppearance}>
          <legend>Markdown 語法色</legend>
          {renderColorGroup('syntax')}
        </fieldset>
      </section>
    </section>
  );
}
