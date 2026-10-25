import { describe, expect, it, vi } from 'vitest';
import {
  clipboardImageFilename,
  localImageResourceID,
  mermaidClipboardFilename,
} from './imageClipboard';

describe('image clipboard helpers', () => {
  it('recognizes only local resource image URLs', () => {
    vi.stubGlobal('window', { location: { href: 'http://wails.localhost/' } });
    expect(localImageResourceID('/resources/0123456789abcdef0123456789abcdef'))
      .toBe('0123456789abcdef0123456789abcdef');
    expect(localImageResourceID('http://wails.localhost/resources/0123456789abcdef0123456789abcdef'))
      .toBe('0123456789abcdef0123456789abcdef');
    expect(localImageResourceID('https://example.com/resources/0123456789abcdef0123456789abcdef'))
      .toBe('');
    expect(localImageResourceID('/resources/short')).toBe('');
    vi.unstubAllGlobals();
  });

  it('creates safe image and Mermaid filenames', () => {
    expect(clipboardImageFilename('photo.jpeg')).toBe('photo.png');
    expect(clipboardImageFilename('bad:name?.svg')).toBe('bad-name-.png');
    expect(mermaidClipboardFilename('系統/流程', 0, 1, 'svg')).toBe('系統-流程.svg');
    expect(mermaidClipboardFilename('系統/流程', 1, 3, 'png')).toBe('系統-流程-02.png');
  });
});
