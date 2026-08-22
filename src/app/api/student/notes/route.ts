import { NextResponse } from 'next/server';
import { generateStructuredNotes } from '@/ai/flows/student-structured-notes';
import { DocumentInputError, normalizeDocument } from '@/lib/document-extractor';

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const document = await normalizeDocument(input.studyMaterialDataUri, input.fileName, input.mimeType);
    const result = await generateStructuredNotes({ ...input, studyMaterialDataUri: document.aiDataUri, studyMaterialText: document.isScannedPdf ? undefined : document.extractedText || undefined, documentFormat: document.format });
    return NextResponse.json({ ...result, documentFormat: document.format, isScannedPdf: document.isScannedPdf });
  } catch (error) {
    if (error instanceof DocumentInputError) return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    console.error('[API] Student notes generation failed:', error);
    return NextResponse.json({ error: 'The document could not be analyzed. Try a smaller, clearer file.' }, { status: 500 });
  }
}
