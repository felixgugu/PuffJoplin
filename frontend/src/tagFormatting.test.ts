import { describe, expect, it } from 'vitest';
import { formatTagLabel } from './tagFormatting';

describe('formatTagLabel', () => {
  it.each([
    [{ title: 'android', count: 1 }, 'android(1)'],
    [{ title: '工作', count: 12 }, '工作(12)'],
    [{ title: 'C++ / .NET', count: 3 }, 'C++ / .NET(3)'],
    [{ title: '  文件  ', count: 4 }, '文件(4)'],
  ])('formats %j', (tag, expected) => {
    expect(formatTagLabel(tag)).toBe(expected);
  });
});
