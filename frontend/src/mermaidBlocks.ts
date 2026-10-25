export interface MermaidBlock {
  code: string;
  startLine: number;
  endLine: number;
}

const openingFencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const closingFencePattern = /^ {0,3}(`{3,}|~{3,})\s*$/;

export function extractMermaidBlocks(markdown: string): MermaidBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MermaidBlock[] = [];
  let fence: {
    character: string;
    length: number;
    startLine: number;
    mermaid: boolean;
  } | null = null;
  let codeLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (fence) {
      const closing = closingFencePattern.exec(line);
      if (closing &&
        closing[1][0] === fence.character &&
        closing[1].length >= fence.length) {
        if (fence.mermaid) {
          const code = codeLines.join('\n').trim();
          if (code) {
            blocks.push({ code, startLine: fence.startLine, endLine: index });
          }
        }
        fence = null;
        codeLines = [];
      } else if (fence.mermaid) {
        codeLines.push(line);
      }
      continue;
    }

    const opening = openingFencePattern.exec(line);
    if (!opening) continue;
    const language = opening[2].trim().split(/\s+/, 1)[0].toLowerCase();
    fence = {
      character: opening[1][0],
      length: opening[1].length,
      startLine: index,
      mermaid: language === 'mermaid',
    };
    codeLines = [];
  }

  return blocks;
}
