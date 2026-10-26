// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EditorSettings from './EditorSettings';
import {
  defaultEditorPreferences,
  sourceFontFamilyStack,
  type EditorPreferences,
} from './editorPreferences';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderSettings(
  preferences: EditorPreferences = defaultEditorPreferences(),
  hidden = false,
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const onChange = vi.fn();
  const onReset = vi.fn();
  act(() => {
    root?.render(
      <EditorSettings
        preferences={preferences}
        theme="light"
        hidden={hidden}
        onChange={onChange}
        onReset={onReset}
      />,
    );
  });
  return { onChange, onReset };
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  vi.useRealTimers();
});

describe('EditorSettings', () => {
  it('shows general mode, line-number, and source appearance controls', () => {
    renderSettings();

    const panel = document.querySelector<HTMLElement>('#settings-panel-editor');
    expect(panel?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('[role="combobox"]')?.textContent)
      .toContain('原始碼');
    expect(document.querySelectorAll('fieldset.source-appearance-controls'))
      .toHaveLength(3);
    expect(document.querySelector<HTMLFieldSetElement>(
      'fieldset.source-typography-controls',
    )?.disabled).toBe(false);
    expect(Array.from(document.querySelectorAll<HTMLFieldSetElement>(
      'fieldset.source-appearance-controls:not(.source-typography-controls)',
    )).every((fieldset) => fieldset.disabled)).toBe(true);
  });

  it('enables appearance fields when custom colors are active', () => {
    const preferences = defaultEditorPreferences();
    preferences.customSourceAppearance = true;
    renderSettings(preferences);

    expect(Array.from(document.querySelectorAll<HTMLFieldSetElement>(
      'fieldset.source-appearance-controls',
    )).every((fieldset) => !fieldset.disabled)).toBe(true);
    const preview = document.querySelector<HTMLElement>('.source-appearance-preview');
    expect(preview?.style.getPropertyValue('--source-foreground')).toBe('#1b1b1b');
    expect(preview?.style.getPropertyValue('--source-background')).toBe('#fbfaf8');
    expect(preview?.style.getPropertyValue('--source-font-family'))
      .toBe(sourceFontFamilyStack('Cascadia Code'));
  });

  it('updates the shared source font family independently of custom colors', () => {
    const { onChange } = renderSettings();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[role="combobox"][aria-label="原始碼字型家族"]',
    );

    act(() => trigger?.click());
    const consolas = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    ).find((option) => option.textContent?.includes('Consolas'));
    act(() => consolas?.click());

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      customSourceAppearance: false,
      sourceTypography: expect.objectContaining({
        fontFamily: 'Consolas',
      }),
    }));
  });

  it('previews and commits a custom installed font name', () => {
    const { onChange } = renderSettings();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[role="combobox"][aria-label="原始碼字型家族"]',
    );
    act(() => trigger?.click());
    const custom = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    ).find((option) => option.textContent?.includes('自訂字型'));
    act(() => custom?.click());

    const input = document.querySelector<HTMLInputElement>(
      'input[placeholder="例如：JetBrains Mono"]',
    );
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    act(() => {
      valueSetter?.call(input, 'JetBrains Mono');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const preview = document.querySelector<HTMLElement>('.source-appearance-preview');
    expect(preview?.style.getPropertyValue('--source-font-family'))
      .toBe(sourceFontFamilyStack('JetBrains Mono'));

    act(() => input?.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      sourceTypography: expect.objectContaining({
        fontFamily: 'JetBrains Mono',
      }),
    }));
  });

  it('honors the hidden tab state and reset action', () => {
    const { onReset } = renderSettings(defaultEditorPreferences(), true);
    const panel = document.querySelector<HTMLElement>('#settings-panel-editor');
    const reset = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent === '恢復預設');

    expect(panel?.hidden).toBe(true);
    act(() => reset?.click());
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid native color-picker updates', () => {
    vi.useFakeTimers();
    const preferences = defaultEditorPreferences();
    preferences.customSourceAppearance = true;
    const { onChange } = renderSettings(preferences);
    const picker = document.querySelector<HTMLInputElement>(
      'input[aria-label="前景色票"]',
    );
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    expect(picker).not.toBeNull();

    const colors = Array.from(
      { length: 120 },
      (_, index) => `#${index.toString(16).padStart(6, '0').slice(-6)}`,
    );
    for (const value of colors) {
      act(() => {
        valueSetter?.call(picker, value);
        picker?.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    expect(onChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(40));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].sourceAppearance.light.foreground).toBe(
      colors[colors.length - 1],
    );
  });
});
