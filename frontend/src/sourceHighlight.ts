import hljs from 'highlight.js/lib/core';
import markdown from 'highlight.js/lib/languages/markdown';
import xml from 'highlight.js/lib/languages/xml';

hljs.registerLanguage('xml', xml);
hljs.registerLanguage('markdown', markdown);

export function highlightMarkdownSource(source: string): string {
  if (!source) return '';
  return hljs.highlight(source, {
    language: 'markdown',
    ignoreIllegals: true,
  }).value;
}
