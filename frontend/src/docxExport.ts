import { renderMermaidImage } from './mermaidExport';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function convertNotebookMarkdownToDocx(
  markdown: string,
  title: string,
): Promise<string> {
  const { convertMarkdownToArrayBuffer } = await import('@mohtasham/md-to-docx');
  const arrayBuffer = await convertMarkdownToArrayBuffer(markdown, {
    documentType: 'report',
    metadata: {
      title,
      creator: 'PuffJoplin',
      company: 'PuffJoplin',
      language: 'zh-Hant',
    },
    accessibility: {
      missingImageAltText: 'permissive',
    },
    mathRendering: {
      enabled: true,
    },
    mermaidRendering: {
      enabled: true,
      failureMode: 'throw',
      render: async ({ code, signal }) => {
        const diagram = await renderMermaidImage(code, 'png', signal);
        return {
          data: diagram.data,
          contentType: diagram.contentType,
          width: diagram.width,
          height: diagram.height,
          altText: 'Mermaid diagram',
          title: 'Mermaid diagram',
        };
      },
    },
    style: {
      fontFamily: 'Microsoft JhengHei UI',
      paragraphSize: 22,
      heading1Size: 34,
      heading2Size: 28,
      heading3Size: 24,
      lineSpacing: 1.3,
      paragraphSpacing: 120,
      headingSpacing: 180,
      tableLayout: 'autofit',
      direction: 'LTR',
      language: 'zh-Hant',
    },
    imageHandling: {
      maxImages: 500,
      maxImageBytes: 50 * 1024 * 1024,
    },
  });
  return arrayBufferToBase64(arrayBuffer);
}
