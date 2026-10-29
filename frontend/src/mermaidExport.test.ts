// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { splitMermaidLabelLines, wrapMermaidLabelLine } from './mermaidExport';

const parseLabel = (html: string): Element => {
  const document = new DOMParser().parseFromString(html, 'text/html');
  return document.body.firstElementChild as Element;
};

const characterWidth = (text: string) => Array.from(text).length * 10;

describe('mermaid export labels', () => {
  it('keeps explicit <br> line breaks', () => {
    expect(splitMermaidLabelLines(parseLabel('<div>CTI / PBX<br>VOICE（MVP）</div>')))
      .toEqual(['CTI / PBX', 'VOICE（MVP）']);
  });

  it('treats markdown paragraphs as separate lines', () => {
    expect(splitMermaidLabelLines(parseLabel('<div><p>第一行</p><p>第二行</p></div>')))
      .toEqual(['第一行', '第二行']);
  });

  it('ignores empty labels', () => {
    expect(splitMermaidLabelLines(parseLabel('<div><br><br> </div>'))).toEqual([]);
  });

  it('wraps long lines at word boundaries', () => {
    expect(wrapMermaidLabelLine('WEBCHAT / VIDEO / SMS', 100, characterWidth))
      .toEqual(['WEBCHAT /', 'VIDEO /', 'SMS']);
  });

  it('breaks unspaced CJK lines by character', () => {
    expect(wrapMermaidLabelLine('其他渠道服務', 25, characterWidth))
      .toEqual(['其他', '渠道', '服務']);
  });

  it('keeps short lines untouched', () => {
    expect(wrapMermaidLabelLine('Outbox', 200, characterWidth)).toEqual(['Outbox']);
  });
});
