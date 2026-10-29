import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import FluentSelect from './FluentSelect';
import UiIcon from './UiIcon';
import {
  MERMAID_COLOR_FIELDS,
  MERMAID_CURVE_OPTIONS,
  MERMAID_FORMAT_OPTIONS,
  MERMAID_SPACING_FIELDS,
  MERMAID_THEME_OPTIONS,
  clampMermaidNumber,
  defaultMermaidConfigDraft,
  formatMermaidConfig,
  normalizeMermaidConfigDraft,
  saveMermaidConfigState,
  type MermaidColorKey,
  type MermaidConfigDraft,
  type MermaidConfigFormat,
  type MermaidConfigState,
  type MermaidSpacingKey,
} from './mermaidConfig';

type NumberKey = MermaidSpacingKey | 'fontSize';

interface MermaidConfigDialogProps {
  initial: MermaidConfigState;
  onClose: () => void;
  onCopy: (text: string) => Promise<void>;
}

const numberDraftsFrom = (draft: MermaidConfigDraft): Record<NumberKey, string> => ({
  fontSize: String(draft.fontSize),
  nodeSpacing: String(draft.nodeSpacing),
  rankSpacing: String(draft.rankSpacing),
  padding: String(draft.padding),
  diagramPadding: String(draft.diagramPadding),
  wrappingWidth: String(draft.wrappingWidth),
});

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const commit = (raw: string) => {
    const candidate = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
    if (/^#[0-9a-f]{6}$/i.test(candidate)) onChange(candidate.toLowerCase());
  };

  return (
    <label className="mermaid-config-color">
      <span className="mermaid-config-color-label">{label}</span>
      <input
        type="color"
        value={value}
        aria-label={`${label} 色票`}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        type="text"
        value={text}
        maxLength={7}
        spellCheck={false}
        aria-label={`${label} 色碼`}
        onChange={(event) => {
          setText(event.target.value);
          commit(event.target.value);
        }}
        onBlur={() => setText(value)}
      />
    </label>
  );
}

export default function MermaidConfigDialog({
  initial,
  onClose,
  onCopy,
}: MermaidConfigDialogProps) {
  const [draft, setDraft] = useState(() => normalizeMermaidConfigDraft(initial.draft));
  const [format, setFormat] = useState<MermaidConfigFormat>(initial.format);
  const [numberDrafts, setNumberDrafts] = useState(() => numberDraftsFrom(draft));
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState('');
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    saveMermaidConfigState({ draft, format });
  }, [draft, format]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || copying) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [copying, onClose]);

  const output = formatMermaidConfig(draft, format);

  const setNumber = (key: NumberKey, raw: string) => {
    setNumberDrafts((current) => ({ ...current, [key]: raw }));
    if (raw.trim() === '') return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      setDraft((current) => ({ ...current, [key]: clampMermaidNumber(key, parsed) }));
    }
  };

  const commitNumber = (key: NumberKey) => {
    setNumberDrafts((current) => ({ ...current, [key]: String(draft[key]) }));
  };

  const setColor = (key: MermaidColorKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    const next = defaultMermaidConfigDraft();
    setDraft(next);
    setNumberDrafts(numberDraftsFrom(next));
    setFormat('directive');
    setError('');
  };

  const copy = async () => {
    if (copying) return;
    setCopying(true);
    setError('');
    try {
      await onCopy(`${formatMermaidConfig(draft, format)}\n`);
      onClose();
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : String(copyError));
      setCopying(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop mermaid-config-backdrop" onMouseDown={copying ? undefined : onClose}>
      <div
        className="modal-card mermaid-config-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mermaid-config-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">Mermaid</span>
            <h2 id="mermaid-config-title">Mermaid 設定</h2>
            <p>調整後按「複製」，再貼到 mermaid 區塊最前面。</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="關閉 Mermaid 設定"
            title="關閉"
            disabled={copying}
            onClick={onClose}
          >
            <UiIcon name="close" />
          </button>
        </header>

        <div className="mermaid-config-body">
          <section className="mermaid-config-section" aria-labelledby="mermaid-config-appearance">
            <h3 id="mermaid-config-appearance">外觀</h3>
            <div className="mermaid-config-grid">
              <div className="mermaid-config-field">
                <span>主題</span>
                <FluentSelect
                  value={draft.theme}
                  options={MERMAID_THEME_OPTIONS}
                  ariaLabel="Mermaid 主題"
                  onChange={(theme) => setDraft((current) => ({ ...current, theme }))}
                />
              </div>
              <label className="mermaid-config-field">
                <span>字級（px）</span>
                <input
                  ref={firstFieldRef}
                  type="number"
                  min={8}
                  max={48}
                  step={1}
                  value={numberDrafts.fontSize}
                  onChange={(event) => setNumber('fontSize', event.target.value)}
                  onBlur={() => commitNumber('fontSize')}
                />
              </label>
            </div>
            <div className="mermaid-config-colors">
              {MERMAID_COLOR_FIELDS.map((field) => (
                <ColorField
                  key={field.key}
                  label={field.label}
                  value={draft[field.key]}
                  onChange={(value) => setColor(field.key, value)}
                />
              ))}
            </div>
          </section>

          <section className="mermaid-config-section" aria-labelledby="mermaid-config-layout">
            <h3 id="mermaid-config-layout">版面</h3>
            <div className="mermaid-config-grid">
              <div className="mermaid-config-field">
                <span>連線曲線</span>
                <FluentSelect
                  value={draft.curve}
                  options={MERMAID_CURVE_OPTIONS}
                  ariaLabel="Mermaid 連線曲線"
                  onChange={(curve) => setDraft((current) => ({ ...current, curve }))}
                />
              </div>
              {MERMAID_SPACING_FIELDS.map((field) => (
                <label className="mermaid-config-field" key={field.key}>
                  <span>{field.label}</span>
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={numberDrafts[field.key]}
                    onChange={(event) => setNumber(field.key, event.target.value)}
                    onBlur={() => commitNumber(field.key)}
                  />
                </label>
              ))}
            </div>
            <div className="mermaid-config-switches">
              <label className="appearance-toggle">
                <input
                  type="checkbox"
                  checked={draft.useMaxWidth}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    useMaxWidth: event.target.checked,
                  }))}
                />
                <span className="appearance-toggle-track" aria-hidden="true" />
                <span>依容器寬度縮放</span>
              </label>
              <label className="appearance-toggle">
                <input
                  type="checkbox"
                  checked={draft.htmlLabels}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    htmlLabels: event.target.checked,
                  }))}
                />
                <span className="appearance-toggle-track" aria-hidden="true" />
                <span>使用 HTML 標籤</span>
              </label>
            </div>
            <p className="mermaid-config-hint">
              版面引擎固定為 dagre；ELK 需額外安裝 <code>@mermaid-js/layout-elk</code> 才會生效。
            </p>
          </section>

          <section className="mermaid-config-section" aria-labelledby="mermaid-config-output-heading">
            <h3 id="mermaid-config-output-heading">輸出</h3>
            <div className="mermaid-config-formats" role="group" aria-label="輸出格式">
              {MERMAID_FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="mermaid-config-format"
                  aria-pressed={format === option.value}
                  title={option.hint}
                  onClick={() => setFormat(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <pre
              className="mermaid-config-output"
              aria-label="Mermaid 設定輸出預覽"
              style={{ '--mermaid-output-height': format === 'json' ? '220px' : '260px' } as CSSProperties}
            >
              {output}
            </pre>
            {error && <p className="mermaid-config-error" role="alert">{error}</p>}
          </section>
        </div>

        <footer>
          <button className="mermaid-config-reset" type="button" disabled={copying} onClick={reset}>
            重設
          </button>
          <button type="button" disabled={copying} onClick={onClose}>取消</button>
          <button className="primary" type="button" disabled={copying} onClick={() => void copy()}>
            <UiIcon name="copy" />
            {copying ? '複製中…' : '複製'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
