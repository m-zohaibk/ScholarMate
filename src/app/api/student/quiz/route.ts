import { NextResponse } from 'next/server';
import { generateStudentQuiz } from '@/ai/flows/student-quiz-generation-flow';

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const result = await generateStudentQuiz(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Student quiz generation failed:', error);
    return NextResponse.json({ error: 'Unable to generate quiz.' }, { status: 500 });
  }
}
