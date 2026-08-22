import { inflateRawSync } from 'node:zlib';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export type SupportedDocument = 'pdf' | 'docx' | 'pptx' | 'image';

export class DocumentInputError extends Error {
  code: 'invalid-data-uri' | 'unsupported-format' | 'empty-document' | 'too-large';
  constructor(message: string, code: DocumentInputError['code']) {
    super(message);
    this.name = 'DocumentInputError';
    this.code = code;
  }
}

function decodeDataUri(dataUri: string) {
  const match = dataUri.match(/^data:([^;,]+)(?:;base64)?,([\s\S]*)$/i);
  if (!match) throw new DocumentInputError('The uploaded file data is invalid.', 'invalid-data-uri');
  const mimeType = match[1].toLowerCase();
  const payload = match[2];
  const buffer = dataUri.toLowerCase().includes(';base64,')
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload));
  if (!buffer.length) throw new DocumentInputError('The uploaded document is empty.', 'empty-document');
  if (buffer.length > 12 * 1024 * 1024) throw new DocumentInputError('The uploaded document is larger than 12MB.', 'too-large');
  return { mimeType, buffer };
}

function detectFormat(fileName: string | undefined, mimeType: string): SupportedDocument {
  const extension = fileName?.split('.').pop()?.toLowerCase();
  if (extension === 'docx' || mimeType.includes('wordprocessingml.document')) return 'docx';
  if (extension === 'pptx' || mimeType.includes('presentationml.presentation')) return 'pptx';
  if (extension === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  throw new DocumentInputError('Use a PDF, image, DOCX, or PPTX file.', 'unsupported-format');
}

function textDataUri(text: string) {
  return `data:text/plain;base64,${Buffer.from(text, 'utf8').toString('base64')}`;
}

function cleanText(text: string) {
  return text.replace(/\u0000/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function readZipEntries(buffer: Buffer) {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('ZIP end record not found');
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map<string, Buffer>();
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('ZIP central directory is invalid');
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const compressed = buffer.subarray(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize);
    if (compression === 0) entries.set(name, Buffer.from(compressed));
    else if (compression === 8) entries.set(name, inflateRawSync(compressed));
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

async function extractPptxText(buffer: Buffer) {
  const entries = readZipEntries(buffer);
  const slideNames = [...entries.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const slides = slideNames.map((name, index) => {
    const xml = entries.get(name)?.toString('utf8') || '';
    const text = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)].map((match) => match[1]).join(' ');
    return text ? `Slide ${index + 1}\n${text}` : '';
  });
  return cleanText(slides.filter(Boolean).join('\n\n'));
}

export async function normalizeDocument(dataUri: string, fileName?: string, declaredMimeType?: string) {
  const { mimeType, buffer } = decodeDataUri(dataUri);
  const format = detectFormat(fileName, declaredMimeType?.toLowerCase() || mimeType);
  let extractedText = '';
  let aiDataUri = dataUri;

  if (format === 'pdf') {
    try {
      const parsed = await pdfParse(buffer);
      extractedText = cleanText(parsed.text || '');
    } catch {
      extractedText = '';
    }
    // Keep the original PDF for Gemini vision when text extraction is empty or incomplete.
    if (extractedText.length > 40) aiDataUri = textDataUri(extractedText);
  } else if (format === 'docx') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = cleanText(result.value || '');
    } catch {
      throw new DocumentInputError('This DOCX file appears to be damaged or unreadable.', 'invalid-data-uri');
    }
    if (!extractedText) throw new DocumentInputError('The DOCX file does not contain readable text.', 'empty-document');
    aiDataUri = textDataUri(extractedText);
  } else if (format === 'pptx') {
    try {
      extractedText = await extractPptxText(buffer);
    } catch {
      throw new DocumentInputError('This PPTX file appears to be damaged or unreadable.', 'invalid-data-uri');
    }
    if (!extractedText) throw new DocumentInputError('The PPTX file does not contain readable slide text.', 'empty-document');
    aiDataUri = textDataUri(extractedText);
  }

  return {
    format,
    fileName: fileName || `uploaded.${format}`,
    extractedText,
    aiDataUri,
    isScannedPdf: format === 'pdf' && extractedText.length <= 40,
  };
}
