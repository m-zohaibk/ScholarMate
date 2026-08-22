'use server';
/**
 * @fileOverview An AI agent that generates customized quizzes for students based on their study materials.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StudentQuizGenerationInputSchema = z.object({
  studyMaterialDataUri: z
    .string()
    .describe(
      "A data URI of the student's study material (PDF, PPTX, DOCX, or Image) that must include a MIME type and use Base64 encoding."
    ),
  questionTypes: z
    .array(z.enum(['MCQ', 'Short Answer', 'Conceptual/Scenario-based']))
    .describe('An array of desired question types for the quiz.'),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe('The desired difficulty level of the quiz.'),
  numberOfQuestions: z.number().int().min(1).describe('The desired number of questions in the quiz.'),
  focusTopics: z
    .array(z.string())
    .optional()
    .describe('Optional array of topics or keywords to focus the quiz questions on.'),
  studyMaterialText: z.string().optional().describe('Text extracted from a DOCX, PPTX, or text-based PDF.'),
  documentFormat: z.string().optional().describe('The uploaded document format.'),
});
export type StudentQuizGenerationInput = z.infer<typeof StudentQuizGenerationInputSchema>;

const StudentQuizQuestionSchema = z.object({
  type: z.enum(['MCQ', 'Short Answer', 'Conceptual/Scenario-based']).describe('The type of the question.'),
  questionText: z.string().describe('The text of the quiz question.'),
  options: z.array(z.string()).optional().describe('An array of 4 options for MCQ. Required for MCQ.'),
  correctAnswer: z.string().describe('The correct answer. For MCQ, this must match one of the options exactly.'),
  explanation: z.string().optional().describe('An explanation of why the answer is correct.'),
});

const StudentQuizGenerationOutputSchema = z.object({
  quizTitle: z.string().describe('The title of the generated quiz.'),
  questions: z.array(StudentQuizQuestionSchema).describe('An array of quiz questions.'),
});
export type StudentQuizGenerationOutput = z.infer<typeof StudentQuizGenerationOutputSchema>;

export async function generateStudentQuiz(
  input: StudentQuizGenerationInput
): Promise<StudentQuizGenerationOutput> {
  return studentQuizGenerationFlow(input);
}

const generateStudentQuizPrompt = ai.definePrompt({
  name: 'generateStudentQuizPrompt',
  input: {schema: StudentQuizGenerationInputSchema},
  output: {schema: StudentQuizGenerationOutputSchema},
  prompt: `You are an expert educator and OCR specialist. 
Your task is to generate a high-quality quiz by analyzing the provided study material. 

VISION CAPABILITIES: 
- Accurately read printed text and handwritten notes.
- Interpret diagrams, charts, and illustrations.
- Perform high-fidelity OCR to extract information from images.

The quiz must adhere to:
- Types: {{{questionTypes}}}
- Difficulty: {{{difficulty}}}
- Question Count: {{{numberOfQuestions}}}

{{#if focusTopics}}
Focus on: {{{focusTopics}}}
{{else}}
Cover the most important concepts throughout the material.
{{/if}}

{{#if studyMaterialText}}
Extracted Study Material Text:
{{{studyMaterialText}}}
{{else}}
Study Material: {{media url=studyMaterialDataUri}}
{{/if}}

Instructions:
1. MCQ: Provide 4 plausible options. The 'correctAnswer' must be the exact text of the correct option.
2. Short Answer: The 'correctAnswer' should be concise (1-2 sentences max).
3. Conceptual: Questions should test understanding, not just recall.
4. ALWAYS provide an explanation that helps the student learn from their mistakes.

Respond strictly in JSON format.`,
});

const studentQuizGenerationFlow = ai.defineFlow(
  {
    name: 'studentQuizGenerationFlow',
    inputSchema: StudentQuizGenerationInputSchema,
    outputSchema: StudentQuizGenerationOutputSchema,
  },
  async input => {
    const {output} = await generateStudentQuizPrompt(input);
    return output!;
  }
);
