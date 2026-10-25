import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

interface FreeNumberInputProps {
  value: number;
  ariaLabel: string;
  min?: number;
  max?: number;
  precision?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
  onDraftChange?: (value: number) => void;
}

export function formatFreeNumber(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return '';
  const factor = 10 ** Math.max(0, precision);
  return String(Math.round(value * factor) / factor);
}

export function normalizeFreeNumberDraft(
  draft: string,
  current: number,
  minimum?: number,
  maximum?: number,
  precision = 6,
): number {
  const parsed = Number(draft.trim().replace(',', '.'));
  if (draft.trim() === '' || !Number.isFinite(parsed)) return current;
  const minimumValue = minimum ?? Number.NEGATIVE_INFINITY;
  const maximumValue = maximum ?? Number.POSITIVE_INFINITY;
  const clamped = Math.max(minimumValue, Math.min(maximumValue, parsed));
  const factor = 10 ** Math.max(0, precision);
  return Math.round(clamped * factor) / factor;
}

export function hasFiniteNumberDraft(draft: string): boolean {
  const normalized = draft.trim().replace(',', '.');
  return normalized !== '' && Number.isFinite(Number(normalized));
}

export default function FreeNumberInput({
  value,
  ariaLabel,
  min,
  max,
  precision = 2,
  disabled = false,
  onCommit,
  onDraftChange,
}: FreeNumberInputProps) {
  const [draft, setDraft] = useState(() => formatFreeNumber(value, precision));
  const [focused, setFocused] = useState(false);
  const cancelRef = useRef(false);
  const focusStartValueRef = useRef(value);

  useEffect(() => {
    if (!focused) setDraft(formatFreeNumber(value, precision));
  }, [focused, precision, value]);

  const commit = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      setDraft(formatFreeNumber(value, precision));
      onCommit(focusStartValueRef.current);
      return;
    }
    const normalized = normalizeFreeNumberDraft(
      draft,
      value,
      min,
      max,
      precision,
    );
    onCommit(normalized);
    setDraft(formatFreeNumber(normalized, precision));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelRef.current = true;
      event.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      aria-label={ariaLabel}
      disabled={disabled}
      onFocus={(event) => {
        focusStartValueRef.current = value;
        setFocused(true);
        setDraft(formatFreeNumber(value, precision));
        event.currentTarget.select();
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        if (onDraftChange && hasFiniteNumberDraft(nextDraft)) {
          onDraftChange(normalizeFreeNumberDraft(
            nextDraft,
            value,
            min,
            max,
            precision,
          ));
        }
      }}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={handleKeyDown}
    />
  );
}
