'use server';
/**
 * @fileOverview An AI agent that generates customized quizzes for students based on their study materials.
 *
 * - generateStudentQuiz - A function that handles the student quiz generation process.
 * - StudentQuizGenerationInput - The input type for the generateStudentQuiz function.
 * - StudentQuizGenerationOutput - The return type for the generateStudentQuiz function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StudentQuizGenerationInputSchema = z.object({
  studyMaterialDataUri: z
    .string()
    .describe(
      "A data URI of the student's study material (PDF, PPTX, DOCX) that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
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
});
export type StudentQuizGenerationInput = z.infer<typeof StudentQuizGenerationInputSchema>;

const StudentQuizQuestionSchema = z.object({
  type: z.enum(['MCQ', 'Short Answer', 'Conceptual/Scenario-based']).describe('The type of the question.'),
  questionText: z.string().describe('The text of the quiz question.'),
  options: z.array(z.string()).optional().describe('An array of options for multiple choice questions. Only present for MCQ type.'),
  correctAnswer: z.string().describe('The correct answer to the question.'),
  explanation: z.string().optional().describe('An optional explanation for the correct answer.'),
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
  prompt: `You are an AI assistant specialized in creating educational quizzes.
Your task is to generate a quiz based on the provided study material, tailored to the student's preferences.

The quiz must contain:
- Question Types: {{{questionTypes}}}
- Difficulty Level: {{{difficulty}}}
- Number of Questions: {{{numberOfQuestions}}}

{{#if focusTopics}}
Focus on these topics/keywords: {{{focusTopics}}}
{{else}}
If no specific focus topics are provided, cover general content from the study material.
{{/if}}

Study Material: {{media url=studyMaterialDataUri}}

Instructions for generating questions:
1.  **General**: Ensure the quiz adheres to the specified question types, difficulty, and number of questions. Provide a clear correct answer and an explanation for each question.
2.  **Multiple Choice Questions (MCQ)**:
    *   Provide exactly 4 options.
    *   The 'correctAnswer' for MCQ should be the full text of the correct option, not its index.
3.  **Short Answer Questions**:
    *   The 'correctAnswer' should be a concise and accurate answer, usually a few words or a short sentence.
4.  **Conceptual/Scenario-based Questions**:
    *   The 'correctAnswer' should be a detailed and comprehensive answer, explaining the concept or analyzing the scenario.

Generate the output in a JSON object strictly adhering to the following schema:
`,
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
