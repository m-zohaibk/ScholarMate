import { get } from '@vercel/blob';
import { getGoogleAiConfigurationError } from '@/lib/google-ai-config';
import { MAX_GEMINI_APP_FILE_BYTES } from '@/lib/document-upload-limits';

const GEMINI_UPLOAD_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const GEMINI_FILES_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_STATUS_POLLS = 25;

export class GeminiFileUploadError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'GeminiFileUploadError';
    this.status = status;
  }
}

type GeminiFile = {
  name?: string;
  uri?: string;
  mimeType?: string;
  state?: 'STATE_UNSPECIFIED' | 'PROCESSING' | 'ACTIVE' | 'FAILED';
  error?: { message?: string };
};

function getApiKey() {
  const configurationError = getGoogleAiConfigurationError();
  if (configurationError) throw new GeminiFileUploadError(configurationError, 503);
  return process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';
}

async function readJson(response: Response, fallback: string) {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new GeminiFileUploadError(fallback, response.status || 502);
  }
}

function normalizeDisplayName(displayName: string) {
  return displayName.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'scholarmate-document.pdf';
}

function validatePdfFileName(displayName: string) {
  const normalized = normalizeDisplayName(displayName);
  return normalized.toLowerCase().endsWith('.pdf') ? normalized : `${normalized}.pdf`;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function startGeminiPdfUpload(sizeBytes: number, displayName: string) {
  const apiKey = getApiKey();
  const startResponse = await fetch(GEMINI_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(sizeBytes),
      'X-Goog-Upload-Header-Content-Type': 'application/pdf',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: validatePdfFileName(displayName) } }),
  });
  console.log('[Gemini PDF] Upload session started:', { status: startResponse.status, sizeBytes });
  if (!startResponse.ok) await readJson(startResponse, 'Gemini rejected the PDF upload session.');
  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new GeminiFileUploadError('Gemini did not return a resumable upload URL.');
  return uploadUrl;
}

async function uploadBytesToGemini(uploadUrl: string, bytes: ArrayBuffer, sizeBytes: number) {
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(sizeBytes),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': 'application/pdf',
    },
    body: bytes,
  });
  console.log('[Gemini PDF] Uploading PDF bytes:', { sizeBytes });
  if (!response.ok) await readJson(response, 'Gemini rejected the PDF bytes.');
  console.log('[Gemini PDF] PDF byte upload response:', { status: response.status });
  const payload = await readJson(response, 'Gemini returned an invalid PDF upload response.') as GeminiFile & { file?: GeminiFile };
  const file = payload.file || payload;
  if (!file.name) throw new GeminiFileUploadError('Gemini did not return a file name after upload.');
  console.log('[Gemini PDF] File uploaded:', { fileName: file.name, hasUri: Boolean(file.uri), state: file.state || 'STATE_UNSPECIFIED' });
  return file.name;
}

async function getGeminiPdfStatusByName(name: string) {
  const apiKey = getApiKey();
  if (!isGeminiFileName(name)) throw new GeminiFileUploadError('The Gemini file reference is invalid.', 422);
  const response = await fetch(`${GEMINI_FILES_URL}/${name}`, { headers: { 'x-goog-api-key': apiKey } });
  if (!response.ok) await readJson(response, 'Gemini could not check the uploaded PDF status.');
  const file = await readJson(response, 'Gemini returned an invalid PDF status response.') as GeminiFile;
  console.log('[Gemini PDF] File state:', { fileName: name, state: file.state || 'STATE_UNSPECIFIED', hasUri: Boolean(file.uri), status: response.status });
  if (file.state === 'FAILED') throw new GeminiFileUploadError(file.error?.message || 'Gemini could not process this PDF.');
  if (!file.name) throw new GeminiFileUploadError('Gemini did not return a usable PDF file reference.');
  if (file.state === 'ACTIVE' && !file.uri) throw new GeminiFileUploadError('Gemini marked the PDF active but did not return a usable file URI.');
  return { fileUri: file.uri || '', fileName: file.name, mimeType: file.mimeType || 'application/pdf', state: file.state || 'STATE_UNSPECIFIED' };
}

export async function uploadGeminiPdfFromBlob(pathname: string, sizeBytes: number, displayName: string) {
  if (!pathname || pathname.includes('..') || pathname.startsWith('/')) throw new GeminiFileUploadError('The uploaded PDF reference is invalid.', 422);
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_GEMINI_APP_FILE_BYTES) {
    throw new GeminiFileUploadError('Please upload a PDF smaller than 10MB.', 413);
  }

  console.log('[Gemini PDF] Blob download started:', { pathname, expectedSizeBytes: sizeBytes });
  const blob = await get(pathname, { access: 'private', useCache: false });
  console.log('[Gemini PDF] Blob lookup completed:', { statusCode: blob?.statusCode, hasStream: Boolean(blob?.stream) });
  if (!blob || blob.statusCode !== 200 || !blob.stream) throw new GeminiFileUploadError('The uploaded PDF could not be retrieved from private storage.', 404);
  const actualSize = blob.blob.size ?? sizeBytes;
  const contentType = blob.blob.contentType || blob.headers.get('content-type') || 'unknown';
  console.log('[Gemini PDF] Blob metadata:', { sizeBytes: actualSize, contentType });
  if (actualSize > MAX_GEMINI_APP_FILE_BYTES) throw new GeminiFileUploadError('Please upload a PDF smaller than 10MB.', 413);
  const bytes = await new Response(blob.stream).arrayBuffer();
  console.log('[Gemini PDF] Blob bytes downloaded:', { sizeBytes: bytes.byteLength, contentType });
  const uploadUrl = await startGeminiPdfUpload(bytes.byteLength, displayName);
  const fileName = await uploadBytesToGemini(uploadUrl, bytes, bytes.byteLength);

  for (let attempt = 0; attempt < MAX_STATUS_POLLS; attempt += 1) {
    const status = await getGeminiPdfStatusByName(fileName);
    if (status.state === 'ACTIVE') return status;
    await sleep(2000);
  }
  throw new GeminiFileUploadError('Gemini is still processing this PDF. Please try again in a moment.', 504);
}

export function isGeminiFileName(value: string) {
  return /^files\/[a-z0-9-]+$/i.test(value);
}

export async function getGeminiPdfStatus(name: string) {
  return getGeminiPdfStatusByName(name);
}
