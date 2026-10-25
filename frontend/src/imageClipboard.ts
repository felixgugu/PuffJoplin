const localResourceSourcePattern = /\/resources\/([A-Za-z0-9]{32})(?![A-Za-z0-9])/;
const invalidFilenamePattern = /[<>:"/\\|?*\u0000-\u001f]/g;

function safeClipboardStem(value: string, fallback: string): string {
  const stem = value
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(invalidFilenamePattern, '-')
    .replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, 100);
  return stem || fallback;
}

export function localImageResourceID(source: string): string {
  try {
    const page = new URL(window.location.href);
    const parsed = new URL(source, page.href);
    if (parsed.origin !== page.origin) return '';
    return parsed.pathname.match(localResourceSourcePattern)?.[1] || '';
  } catch {
    return '';
  }
}

export function clipboardImageFilename(filename: string): string {
  return `${safeClipboardStem(filename, 'PuffJoplin-image')}.png`;
}

export function mermaidClipboardFilename(
  noteTitle: string,
  index: number,
  count: number,
  extension: 'png' | 'svg',
): string {
  const stem = safeClipboardStem(noteTitle, 'PuffJoplin-note');
  const suffix = count > 1 ? `-${String(index + 1).padStart(2, '0')}` : '';
  return `${stem}${suffix}.${extension}`;
}

export async function rasterizeImageToPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width <= 0 || bitmap.height <= 0 ||
      bitmap.width * bitmap.height > 100_000_000) {
      throw new Error('圖片尺寸過大，無法複製');
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('無法建立圖片畫布');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('圖片轉換 PNG 失敗'));
      }, 'image/png');
    });
  } finally {
    bitmap.close();
  }
}
