import { NextResponse } from 'next/server';
import { generateStructuredNotes } from '@/ai/flows/student-structured-notes';
import { DocumentInputError, normalizeDocument } from '@/lib/document-extractor';
import { ocrRenderedPdfPages } from '@/lib/scanned-pdf-ocr';
import { getGoogleAiConfigurationError } from '@/lib/google-ai-config';

export async function POST(request: Request) {
  const configurationError = getGoogleAiConfigurationError();
  if (configurationError) return NextResponse.json({ error: configurationError }, { status: 503 });
  try {
    const input = await request.json();
    const document = await normalizeDocument(input.studyMaterialDataUri, input.fileName, input.mimeType, { text: input.studyMaterialText, pageImages: input.pdfPageImages });
    const ocrText = document.isScannedPdf ? await ocrRenderedPdfPages(document.pdfPageImages) : '';
    if (document.isScannedPdf && !ocrText) return NextResponse.json({ error: 'No readable text was found in the scanned PDF. Upload a higher-resolution scan or a clearer image.' }, { status: 422 });
    const result = await generateStructuredNotes({ ...input, studyMaterialDataUri: document.aiDataUri, studyMaterialText: ocrText || document.extractedText || undefined, documentFormat: document.format });
    return NextResponse.json({ ...result, documentFormat: document.format, isScannedPdf: document.isScannedPdf, ocrPages: document.pdfPageImages.length });
  } catch (error) {
    if (error instanceof DocumentInputError) return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    console.error('[API] Student notes generation failed:', error);
    const providerMessage = String((error as { originalMessage?: unknown })?.originalMessage || error);
    if (providerMessage.includes('401 Unauthorized')) return NextResponse.json({ error: 'Google AI authentication failed. Use a Google AI Studio API key in GOOGLE_GENAI_API_KEY, not an OAuth token.' }, { status: 503 });
    if (providerMessage.includes('429')) return NextResponse.json({ error: 'Google AI rate limit reached. Wait a moment and try again.' }, { status: 429 });
    if (/invalid json|json.*parse|parse.*json|schema validation/i.test(providerMessage.toLowerCase())) return NextResponse.json({ error: 'Gemini returned an invalid structured response. The PDF was accepted; wait a moment and try again.' }, { status: 502 });
    return NextResponse.json({ error: 'The document could not be analyzed. Try a smaller, clearer file.' }, { status: 500 });
  }
}
