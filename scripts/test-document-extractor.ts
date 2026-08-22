import JSZip from 'jszip';
import { normalizeDocument } from '../src/lib/document-extractor';

const toDataUri = (mime: string, buffer: Buffer) => `data:${mime};base64,${buffer.toString('base64')}`;

async function main() {
  const docx = new JSZip();
  docx.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Biology syllabus and cell structure</w:t></w:r></w:p></w:body></w:document>');
  const docxResult = await normalizeDocument(toDataUri('application/vnd.openxmlformats-officedocument.wordprocessingml.document', await docx.generateAsync({ type: 'nodebuffer' })), 'biology.docx');
  if (!docxResult.extractedText.includes('Biology syllabus')) throw new Error('DOCX extraction failed');

  const pptx = new JSZip();
  pptx.file('ppt/slides/slide1.xml', '<p:sld><p:cSld><a:t>Photosynthesis</a:t><a:t>Light reactions</a:t></p:cSld></p:sld>');
  const pptxResult = await normalizeDocument(toDataUri('application/vnd.openxmlformats-officedocument.presentationml.presentation', await pptx.generateAsync({ type: 'nodebuffer' })), 'lesson.pptx');
  if (!pptxResult.extractedText.includes('Photosynthesis')) throw new Error('PPTX extraction failed');

  const pdfResult = await normalizeDocument(toDataUri('application/pdf', Buffer.from('%PDF-invalid-scanned-placeholder')), 'scan.pdf');
  if (!pdfResult.isScannedPdf || pdfResult.aiDataUri === '') throw new Error('Scanned PDF fallback failed');

  console.log('document extractor smoke test passed');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
