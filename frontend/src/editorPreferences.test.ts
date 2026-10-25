import { describe, expect, it } from 'vitest';
import { parseShowSourceLineNumbers } from './editorPreferences';

describe('source editor preferences', () => {
  it('shows source line numbers by default', () => {
    expect(parseShowSourceLineNumbers(null)).toBe(true);
    expect(parseShowSourceLineNumbers('true')).toBe(true);
    expect(parseShowSourceLineNumbers('unexpected')).toBe(true);
  });

  it('keeps an explicit choice to hide line numbers', () => {
    expect(parseShowSourceLineNumbers('false')).toBe(false);
  });
});
