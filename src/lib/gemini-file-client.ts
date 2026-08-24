import { parseApiResponse } from '@/lib/api-response';
import { MAX_DIRECT_GEMINI_FILE_UPLOAD_BYTES } from '@/lib/document-upload-limits';

export type GeminiPdfUploadResult = {
  fileUri: string;
  fileName: string;
  mimeType: string;
};

export async function uploadPdfForGemini(file: File) {
  if (file.size > MAX_DIRECT_GEMINI_FILE_UPLOAD_BYTES) {
    throw new Error('This PDF is larger than the safe direct-upload size. The browser OCR fallback will be used.');
  }

  const response = await fetch('/api/documents/gemini-file', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  });
  return parseApiResponse<GeminiPdfUploadResult>(response);
}
