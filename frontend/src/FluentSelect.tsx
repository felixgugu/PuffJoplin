import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import UiIcon from './UiIcon';

export interface FluentSelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface FluentSelectProps<T extends string> {
  value: T;
  options: readonly FluentSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export default function FluentSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  disabled = false,
}: FluentSelectProps<T>) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const open = menuPosition !== null;
  const selectedOption = options.find((option) => option.value === value);

  const closeMenu = (restoreFocus = false) => {
    setMenuPosition(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const openMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger || disabled) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const estimatedHeight = Math.max(96, Math.min(280, options.length * 34 + 10));
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openAbove = spaceBelow < Math.min(estimatedHeight, 152) && spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;
    const width = Math.min(
      Math.max(rect.width, 148),
      Math.max(148, window.innerWidth - viewportPadding * 2),
    );
    const left = Math.max(
      viewportPadding,
      Math.min(rect.left, window.innerWidth - width - viewportPadding),
    );
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - Math.min(estimatedHeight, availableSpace) - 6)
      : rect.bottom + 6;

    setMenuPosition({
      left,
      top,
      width,
      maxHeight: Math.max(88, Math.min(280, availableSpace)),
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuPosition(null);
    };
    const closeOnViewportChange = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuPosition(null);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMenu(true);
    };
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    document.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      window.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      document.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const selected = menuRef.current?.querySelector<HTMLButtonElement>(
        '[role="option"][aria-selected="true"]:not(:disabled)',
      );
      const first = menuRef.current?.querySelector<HTMLButtonElement>(
        '[role="option"]:not(:disabled)',
      );
      (selected || first)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const choose = (nextValue: T) => {
    onChange(nextValue);
    closeMenu(true);
  };

  const focusOptionAt = (index: number) => {
    const enabledOptions = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]:not(:disabled)',
      ) ?? [],
    );
    if (enabledOptions.length === 0) return;
    const normalized = (index + enabledOptions.length) % enabledOptions.length;
    enabledOptions[normalized]?.focus();
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const enabledOptions = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]:not(:disabled)',
      ) ?? [],
    );
    const currentIndex = enabledOptions.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOptionAt(currentIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusOptionAt(currentIndex <= 0 ? enabledOptions.length - 1 : currentIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusOptionAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusOptionAt(enabledOptions.length - 1);
    } else if (event.key === 'Tab') {
      closeMenu();
    }
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' &&
      event.key !== 'Home' && event.key !== 'End')) {
      return;
    }
    event.preventDefault();
    openMenu();
  };

  return (
    <div className={`fluent-select ${className}`.trim()}>
      <button
        ref={triggerRef}
        className="fluent-select-trigger"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => open ? closeMenu() : openMenu()}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="fluent-select-value">{selectedOption?.label ?? ''}</span>
        <UiIcon name="chevron-down" className="fluent-select-chevron" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className="fluent-select-menu"
          role="listbox"
          aria-label={ariaLabel}
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
          onKeyDown={handleMenuKeyDown}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {options.map((option) => (
            <button
              className="fluent-select-option"
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              key={option.value}
              onClick={() => choose(option.value)}
            >
              <span className="fluent-select-check" aria-hidden="true">
                {option.value === value ? '✓' : ''}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
