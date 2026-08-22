import { NextResponse } from 'next/server';
import { generateStudentQuiz } from '@/ai/flows/student-quiz-generation-flow';
import { DocumentInputError, normalizeDocument } from '@/lib/document-extractor';
import { ocrRenderedPdfPages } from '@/lib/scanned-pdf-ocr';

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const document = await normalizeDocument(input.studyMaterialDataUri, input.fileName, input.mimeType);
    const ocrText = document.isScannedPdf ? await ocrRenderedPdfPages(document.pdfPageImages) : '';
    if (document.isScannedPdf && !ocrText) return NextResponse.json({ error: 'No readable text was found in the scanned PDF. Upload a higher-resolution scan or a clearer image.' }, { status: 422 });
    const result = await generateStudentQuiz({ ...input, studyMaterialDataUri: document.aiDataUri, studyMaterialText: ocrText || document.extractedText || undefined, documentFormat: document.format });
    return NextResponse.json({ ...result, documentFormat: document.format, isScannedPdf: document.isScannedPdf, ocrPages: document.pdfPageImages.length });
  } catch (error) {
    if (error instanceof DocumentInputError) return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    console.error('[API] Student quiz generation failed:', error);
    return NextResponse.json({ error: 'The document could not be analyzed. Try a smaller, clearer file.' }, { status: 500 });
  }
}
