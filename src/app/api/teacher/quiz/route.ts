import { NextResponse } from 'next/server';
import { generateTeacherQuiz } from '@/ai/flows/teacher-quiz-generation';

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const result = await generateTeacherQuiz(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Teacher quiz generation failed:', error);
    return NextResponse.json({ error: 'Unable to generate quiz.' }, { status: 500 });
  }
}
