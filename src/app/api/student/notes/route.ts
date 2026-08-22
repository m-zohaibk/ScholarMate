import { NextResponse } from 'next/server';
import { generateStructuredNotes } from '@/ai/flows/student-structured-notes';

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const result = await generateStructuredNotes(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Student notes generation failed:', error);
    return NextResponse.json({ error: 'Unable to generate notes.' }, { status: 500 });
  }
}
