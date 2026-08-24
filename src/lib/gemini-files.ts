import { getGoogleAiConfigurationError } from '@/lib/google-ai-config';
import { MAX_GEMINI_APP_FILE_BYTES } from '@/lib/document-upload-limits';
const GEMINI_UPLOAD_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const GEMINI_FILES_URL = 'https://generativelanguage.googleapis.com/v1beta';

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

export async function createGeminiPdfUploadSession(sizeBytes: number, displayName: string) {
  const apiKey = getApiKey();
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) throw new GeminiFileUploadError('The PDF size is invalid.', 422);
  if (sizeBytes > MAX_GEMINI_APP_FILE_BYTES) throw new GeminiFileUploadError('Please upload a PDF smaller than 10MB.', 413);

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
  if (!startResponse.ok) await readJson(startResponse, 'Gemini rejected the PDF upload session.');
  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new GeminiFileUploadError('Gemini did not return a resumable upload URL.');

  return { uploadUrl, fileName: validatePdfFileName(displayName), sizeBytes };
}

export function isGeminiFileName(value: string) {
  return /^files\/[a-z0-9-]+$/i.test(value);
}

export async function getGeminiPdfStatus(name: string) {
  const apiKey = getApiKey();
  if (!isGeminiFileName(name)) throw new GeminiFileUploadError('The Gemini file reference is invalid.', 422);
  const response = await fetch(`${GEMINI_FILES_URL}/${name}`, { headers: { 'x-goog-api-key': apiKey } });
  if (!response.ok) await readJson(response, 'Gemini could not check the uploaded PDF status.');
  const file = await readJson(response, 'Gemini returned an invalid PDF status response.') as GeminiFile;
  if (file.state === 'FAILED') throw new GeminiFileUploadError(file.error?.message || 'Gemini could not process this PDF.');
  if (!file.uri || !file.name) throw new GeminiFileUploadError('Gemini did not return a usable PDF file reference.');
  return { fileUri: file.uri, fileName: file.name, mimeType: file.mimeType || 'application/pdf', state: file.state || 'STATE_UNSPECIFIED' };
}
