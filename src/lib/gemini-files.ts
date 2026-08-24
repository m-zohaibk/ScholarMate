import { getGoogleAiConfigurationError } from '@/lib/google-ai-config';
import { MAX_DIRECT_GEMINI_FILE_UPLOAD_BYTES } from '@/lib/document-upload-limits';
const GEMINI_UPLOAD_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const GEMINI_FILES_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_PROCESSING_POLLS = 20;

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

function getFileError(file: GeminiFile) {
  return file.error?.message || 'Gemini could not process this PDF.';
}

export async function uploadPdfToGemini(request: Request, displayName = 'scholarmate-document.pdf') {
  const apiKey = getApiKey();
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_DIRECT_GEMINI_FILE_UPLOAD_BYTES) {
    throw new GeminiFileUploadError('This PDF is too large for the direct Gemini upload path. Use a smaller file or the browser OCR fallback.', 413);
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length) throw new GeminiFileUploadError('The uploaded PDF is empty.', 422);
  if (bytes.length > MAX_DIRECT_GEMINI_FILE_UPLOAD_BYTES) {
    throw new GeminiFileUploadError('This PDF is too large for the direct Gemini upload path. Use a smaller file or the browser OCR fallback.', 413);
  }

  const safeDisplayName = displayName.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'scholarmate-document.pdf';
  const startResponse = await fetch(GEMINI_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length),
      'X-Goog-Upload-Header-Content-Type': 'application/pdf',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: safeDisplayName } }),
  });
  if (!startResponse.ok) await readJson(startResponse, 'Gemini rejected the PDF upload request.');
  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new GeminiFileUploadError('Gemini did not return a resumable upload URL.');

  const finalizeResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(bytes.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: bytes,
  });
  if (!finalizeResponse.ok) await readJson(finalizeResponse, 'Gemini could not receive the PDF bytes.');
  const finalized = await readJson(finalizeResponse, 'Gemini returned an invalid file-upload response.');
  let file = (finalized.file || finalized) as GeminiFile;
  if (!file.name || !file.uri) throw new GeminiFileUploadError('Gemini did not return a usable PDF file reference.');

  for (let attempt = 0; file.state === 'PROCESSING' && attempt < MAX_PROCESSING_POLLS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const statusResponse = await fetch(`${GEMINI_FILES_URL}/${file.name}`, { headers: { 'x-goog-api-key': apiKey } });
    if (!statusResponse.ok) await readJson(statusResponse, 'Gemini could not check the uploaded PDF status.');
    file = (await readJson(statusResponse, 'Gemini returned an invalid PDF status response.')) as GeminiFile;
  }

  if (file.state === 'FAILED') throw new GeminiFileUploadError(getFileError(file));
  if (file.state === 'PROCESSING') throw new GeminiFileUploadError('Gemini is still processing this PDF. Please try again in a moment.', 202);
  if (file.state !== 'ACTIVE' || !file.uri) throw new GeminiFileUploadError('Gemini did not activate the uploaded PDF.');

  return { fileUri: file.uri, fileName: safeDisplayName, mimeType: file.mimeType || 'application/pdf' };
}
