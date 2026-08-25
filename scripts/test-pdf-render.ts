import { readFile } from 'node:fs/promises';
import { renderPdfPagesToImages } from '../src/lib/document-extractor';

async function main() {
  const pdf = await readFile('/tmp/scholarmate-scanned-fixture.pdf');
  const pages = await renderPdfPagesToImages(pdf);
  if (pages.length !== 1 || !pages[0].startsWith('data:image/png;base64,')) throw new Error('PDF page rendering failed');
  console.log(`pdf render test passed: ${pages.length} page`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
