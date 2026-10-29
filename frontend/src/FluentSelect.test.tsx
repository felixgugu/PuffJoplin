// @vitest-environment happy-dom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FluentSelect from './FluentSelect';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function SelectHarness({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('updated');
  return (
    <FluentSelect
      value={value}
      options={[
        { value: 'title', label: '字母' },
        { value: 'updated', label: '修改日期' },
        { value: 'created', label: '新增日期' },
      ]}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      ariaLabel="筆記排序方式"
    />
  );
}

function renderSelect() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const onChange = vi.fn();
  act(() => {
    root?.render(<SelectHarness onChange={onChange} />);
  });
  return onChange;
}

function IconSelectHarness() {
  const [value, setValue] = useState('updated');
  return (
    <FluentSelect
      value={value}
      iconOnly
      options={[
        { value: 'title', label: '字母', icon: 'sort-title' },
        { value: 'updated', label: '修改日期', icon: 'sort-updated' },
      ]}
      onChange={setValue}
      ariaLabel="筆記排序方式"
    />
  );
}

function renderIconSelect() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(<IconSelectHarness />);
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  document.querySelectorAll('.fluent-select-menu').forEach((menu) => menu.remove());
});

describe('FluentSelect', () => {
  it('renders a portal listbox and selects an option', () => {
    const onChange = renderSelect();
    const trigger = document.querySelector<HTMLButtonElement>('[role="combobox"]');

    act(() => trigger?.click());
    const menu = document.querySelector<HTMLElement>('[role="listbox"]');
    expect(menu?.parentElement).toBe(document.body);

    const title = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((option) => option.textContent?.includes('字母'));
    act(() => title?.click());

    expect(onChange).toHaveBeenCalledWith('title');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(trigger?.textContent).toContain('字母');
  });

  it('renders icon-only triggers without repeating the label', () => {
    renderIconSelect();
    const trigger = document.querySelector<HTMLButtonElement>('[role="combobox"]');

    expect(trigger?.textContent).not.toContain('修改日期');
    expect(trigger?.getAttribute('aria-label')).toBe('筆記排序方式：修改日期');
    expect(trigger?.querySelector('.fluent-select-icon')).not.toBeNull();

    act(() => trigger?.click());
    const menu = document.querySelector<HTMLElement>('[role="listbox"]');
    expect(menu?.querySelectorAll('.fluent-select-option-icon').length).toBe(2);
    expect(menu?.textContent).toContain('修改日期');
  });

  it('supports keyboard navigation and Escape focus return', async () => {
    renderSelect();
    const trigger = document.querySelector<HTMLButtonElement>('[role="combobox"]');

    act(() => {
      trigger?.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
      }));
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });
    const selected = document.querySelector<HTMLButtonElement>(
      '[role="option"][aria-selected="true"]',
    );
    expect(document.activeElement).toBe(selected);

    act(() => {
      selected?.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
      }));
    });
    expect(document.activeElement?.textContent).toContain('字母');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      }));
    });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });
});
