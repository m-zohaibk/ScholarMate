import { normalizeDocument } from '../src/lib/document-extractor';

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries: Record<string, string>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBuffer.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    nameBuffer.copy(local, 30);
    data.copy(local, 30 + nameBuffer.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + nameBuffer.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBuffer.copy(central, 46);
    centralParts.push(central);
    offset += local.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

const toDataUri = (mime: string, buffer: Buffer) => `data:${mime};base64,${buffer.toString('base64')}`;

async function main() {
  const docx = createStoredZip({ 'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Biology syllabus and cell structure</w:t></w:r></w:p></w:body></w:document>' });
  const docxResult = await normalizeDocument(toDataUri('application/vnd.openxmlformats-officedocument.wordprocessingml.document', docx), 'biology.docx');
  if (!docxResult.extractedText.includes('Biology syllabus')) throw new Error('DOCX extraction failed');

  const pptx = createStoredZip({ 'ppt/slides/slide1.xml': '<p:sld><p:cSld><a:t>Photosynthesis</a:t><a:t>Light reactions</a:t></p:cSld></p:sld>' });
  const pptxResult = await normalizeDocument(toDataUri('application/vnd.openxmlformats-officedocument.presentationml.presentation', pptx), 'lesson.pptx');
  if (!pptxResult.extractedText.includes('Photosynthesis')) throw new Error('PPTX extraction failed');

  const pdfResult = await normalizeDocument(toDataUri('application/pdf', Buffer.from('%PDF-invalid-scanned-placeholder')), 'scan.pdf');
  if (!pdfResult.isScannedPdf || pdfResult.aiDataUri === '') throw new Error('Scanned PDF fallback failed');

  console.log('document extractor smoke test passed');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
