'use client';

const MAX_OCR_PAGES = 4;
const MAX_RENDER_WIDTH = 1400;
const JPEG_QUALITY = 0.78;

export type BrowserPdfPreparation = {
  text: string;
  pageImages: string[];
};

function cleanText(text: string) {
  return text.replace(/\u0000/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function preparePdfForUpload(file: File): Promise<BrowserPdfPreparation> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const textPages: string[] = [];
  const pageImages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    if (pageText) textPages.push(pageText);

    if (pageNumber <= MAX_OCR_PAGES) {
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2, MAX_RENDER_WIDTH / baseViewport.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The browser could not create a PDF rendering canvas.');
      await page.render({ canvasContext: context, viewport }).promise;
      pageImages.push(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      canvas.width = 1;
      canvas.height = 1;
    }
  }

  return { text: cleanText(textPages.join('\n\n')), pageImages };
}
