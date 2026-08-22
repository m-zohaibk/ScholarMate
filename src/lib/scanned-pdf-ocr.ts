import { ocrDocumentPage } from '@/ai/flows/document-page-ocr';

export async function ocrRenderedPdfPages(pageImages: string[]) {
  const pages: string[] = [];
  for (let index = 0; index < pageImages.length; index += 1) {
    const result = await ocrDocumentPage({ imageDataUri: pageImages[index], pageNumber: index + 1 });
    const text = result?.text?.trim();
    if (text) pages.push(`Page ${index + 1}\n${text}`);
  }
  return pages.join('\n\n').trim();
}
