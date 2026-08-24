import { parseApiResponse } from '@/lib/api-response';
import { MAX_GEMINI_APP_FILE_BYTES } from '@/lib/document-upload-limits';

export type GeminiPdfUploadResult = {
  fileUri: string;
  fileName: string;
  mimeType: string;
};

type UploadSession = {
  uploadUrl: string;
  fileName: string;
  sizeBytes: number;
};

type GeminiUploadResponse = {
  file?: {
    name?: string;
    uri?: string;
    mimeType?: string;
    state?: string;
  };
  name?: string;
  uri?: string;
  mimeType?: string;
  state?: string;
};

const MAX_STATUS_POLLS = 30;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function uploadPdfForGemini(file: File): Promise<GeminiPdfUploadResult> {
  if (file.size > MAX_GEMINI_APP_FILE_BYTES) {
    throw new Error('Please upload a PDF smaller than 10MB.');
  }

  const sessionResponse = await fetch('/api/documents/gemini-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sizeBytes: file.size, fileName: file.name, mimeType: 'application/pdf' }),
  });
  const session = await parseApiResponse<UploadSession>(sessionResponse);

  const uploadResponse = await fetch(session.uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': 'application/pdf',
    },
    body: file,
  });
  const upload = await parseApiResponse<GeminiUploadResponse>(uploadResponse);
  const uploadedFile = upload.file || upload;
  const fileName = uploadedFile.name;
  if (!fileName) throw new Error('Gemini did not return a file name after upload.');

  for (let attempt = 0; attempt < MAX_STATUS_POLLS; attempt += 1) {
    const statusResponse = await fetch('/api/documents/gemini-file/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fileName }),
    });
    const status = await parseApiResponse<GeminiPdfUploadResult & { state?: string }>(statusResponse);
    if (status.state === 'ACTIVE' && status.fileUri) return status;
    await sleep(500);
  }

  throw new Error('Gemini is still processing this PDF. Please try again in a moment.');
}
