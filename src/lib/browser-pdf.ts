const MAX_OCR_PAGES = 14;
const MAX_RENDER_WIDTH = 1024;
const MAX_RENDER_HEIGHT = 1400;
const JPEG_QUALITY = 0.62;
const FALLBACK_JPEG_QUALITY = 0.48;

/** Keep a margin below Vercel's request-body ceiling for JSON and platform headers. */
export const MAX_BROWSER_PDF_PAYLOAD_BYTES = 3_200_000;
export const MAX_GENERATION_REQUEST_BYTES = 4_000_000;

export type BrowserPdfPreparation = {
  text: string;
  pageImages: string[];
  totalPages: number;
  renderedPages: number;
  truncated: boolean;
};

function cleanText(text: string) {
  return text.replace(/\u0000/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export function estimatePdfPageImagesBytes(pageImages: string[]) {
  return utf8ByteLength(JSON.stringify(pageImages));
}

function renderPageImage(canvas: HTMLCanvasElement) {
  const preferred = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  if (utf8ByteLength(preferred) <= MAX_BROWSER_PDF_PAYLOAD_BYTES) return preferred;
  return canvas.toDataURL('image/jpeg', FALLBACK_JPEG_QUALITY);
}

export async function preparePdfForUpload(file: File): Promise<BrowserPdfPreparation> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const textPages: string[] = [];
  const pageImages: string[] = [];
  let truncated = false;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    if (pageText) textPages.push(pageText);

    if (pageNumber <= MAX_OCR_PAGES && !truncated) {
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(1.6, MAX_RENDER_WIDTH / baseViewport.width, MAX_RENDER_HEIGHT / baseViewport.height);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The browser could not create a PDF rendering canvas.');
      await page.render({ canvasContext: context, viewport }).promise;
      const image = renderPageImage(canvas);
      const candidate = [...pageImages, image];
      if (estimatePdfPageImagesBytes(candidate) > MAX_BROWSER_PDF_PAYLOAD_BYTES) {
        if (pageImages.length === 0) {
          canvas.width = Math.max(1, Math.floor(canvas.width * 0.75));
          canvas.height = Math.max(1, Math.floor(canvas.height * 0.75));
          const reducedImage = canvas.toDataURL('image/jpeg', FALLBACK_JPEG_QUALITY);
          if (estimatePdfPageImagesBytes([reducedImage]) > MAX_BROWSER_PDF_PAYLOAD_BYTES) {
            canvas.width = 1;
            canvas.height = 1;
            throw new Error('This scanned page is too detailed to send safely. Use a smaller or lower-resolution scan.');
          }
          pageImages.push(reducedImage);
        }
        truncated = true;
      } else {
        pageImages.push(image);
      }
      canvas.width = 1;
      canvas.height = 1;
    } else if (pageNumber > MAX_OCR_PAGES) {
      truncated = true;
    }
  }

  return {
    text: cleanText(textPages.join('\n\n')),
    pageImages,
    totalPages: pdf.numPages,
    renderedPages: pageImages.length,
    truncated,
  };
}
