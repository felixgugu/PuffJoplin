import { buildXlsxSheets, type MarkdownTable } from './markdownTables';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function xlsxExportFilename(noteTitle: string): string {
  const title = noteTitle.trim() || 'PuffJoplin';
  return `${title}-表格.xlsx`;
}

export async function convertTablesToXlsxBase64(
  tables: readonly MarkdownTable[],
): Promise<string> {
  if (tables.length === 0) {
    throw new Error('沒有可匯出的表格');
  }
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const blob = await writeXlsxFile(buildXlsxSheets(tables), {
    fontFamily: 'Microsoft JhengHei UI',
    fontSize: 11,
  }).toBlob();
  return arrayBufferToBase64(await blob.arrayBuffer());
}
