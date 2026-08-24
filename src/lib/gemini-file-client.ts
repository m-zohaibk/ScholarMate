import { upload } from '@vercel/blob/client';
import { parseApiResponse } from '@/lib/api-response';
import { MAX_GEMINI_APP_FILE_BYTES } from '@/lib/document-upload-limits';

export type GeminiPdfUploadResult = {
  fileUri: string;
  fileName: string;
  mimeType: string;
  state: 'STATE_UNSPECIFIED' | 'PROCESSING' | 'ACTIVE' | 'FAILED';
};

type GeminiIngestionResponse = GeminiPdfUploadResult;

export async function uploadPdfForGemini(file: File): Promise<GeminiPdfUploadResult> {
  if (file.size > MAX_GEMINI_APP_FILE_BYTES) {
    throw new Error('Please upload a PDF smaller than 10MB.');
  }

  const blob = await upload(`scholarmate-pdfs/${file.name}`, file, {
    access: 'private',
    contentType: 'application/pdf',
    multipart: true,
    handleUploadUrl: '/api/documents/blob-upload',
  });

  const ingestionResponse = await fetch('/api/documents/gemini-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pathname: blob.pathname,
      sizeBytes: file.size,
      fileName: file.name,
      mimeType: 'application/pdf',
    }),
  });
  return parseApiResponse<GeminiIngestionResponse>(ingestionResponse);
}
