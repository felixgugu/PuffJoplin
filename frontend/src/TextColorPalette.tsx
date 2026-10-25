import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import { TEXT_COLORS } from './textColor';
import UiIcon from './UiIcon';

interface TextColorPaletteProps {
  x: number;
  y: number;
  selectedColor: string;
  onSelect: (color: string) => void;
  onReset: () => void;
  onClose: () => void;
}

const paletteWidth = 214;
const paletteHeight = 236;

export default function TextColorPalette({
  x,
  y,
  selectedColor,
  onSelect,
  onReset,
  onClose,
}: TextColorPaletteProps) {
  return createPortal(
    <div
      className="editor-text-color-palette"
      role="dialog"
      aria-label="文字顏色"
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - paletteWidth - 8)),
        top: Math.max(8, Math.min(y, window.innerHeight - paletteHeight - 8)),
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="text-color-palette-title">文字顏色</div>
      <div className="text-color-grid" role="group" aria-label="常用文字顏色">
        {TEXT_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            className={`text-color-swatch ${selectedColor === color.value ? 'active' : ''}`}
            style={{ '--text-color-swatch': color.value } as CSSProperties}
            title={`${color.name} ${color.value}`}
            aria-label={`${color.name} ${color.value}`}
            onClick={() => onSelect(color.value)}
          >
            {selectedColor === color.value && <span aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="text-color-reset"
        onClick={onReset}
      >
        <UiIcon name="close" />
        恢復預設色
      </button>
    </div>,
    document.body,
  );
}
