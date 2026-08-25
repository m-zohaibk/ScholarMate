'use server';
/**
 * @fileOverview A Genkit flow for teachers to generate quizzes based on syllabus or topics.
 *
 * - generateTeacherQuiz - A function that handles the quiz generation process.
 * - GenerateTeacherQuizInput - The input type for the generateTeacherQuiz function.
 * - GenerateTeacherQuizOutput - The return type for the generateTeacherQuiz function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input Schema
const QuestionTypeSchema = z.enum(['MCQ', 'short-answer', 'conceptual']);
const DifficultySchema = z.enum(['easy', 'medium', 'hard']);

const GenerateTeacherQuizInputSchema = z.object({
  syllabusOrTopics: z.string().optional().describe('The syllabus or list of topics to generate the quiz from.'),
  syllabusFileUri: z.string().optional().describe('Optional Gemini Files API URI for the source PDF.'),
  questionTypes: z.array(QuestionTypeSchema).describe('The types of questions to include in the quiz (e.g., MCQ, short-answer, conceptual).'),
  difficulty: DifficultySchema.describe('The difficulty level for the quiz questions.'),
  includeKeywords: z.array(z.string()).optional().describe('Optional: Keywords that must be included in the quiz questions or answers.'),
  excludeKeywords: z.array(z.string()).optional().describe('Optional: Keywords that must be explicitly avoided in the quiz questions or answers.'),
  numQuestions: z.number().int().min(1).default(5).describe('The desired number of questions for the quiz.'),
});
export type GenerateTeacherQuizInput = z.infer<typeof GenerateTeacherQuizInputSchema>;

// Output Schema
const QuizQuestionSchema = z.object({
  type: QuestionTypeSchema.describe('The type of question (MCQ, short-answer, conceptual).'),
  questionText: z.string().describe('The text of the quiz question.'),
  options: z.array(z.string()).optional().describe('For MCQ questions: an array of possible answer options.'),
  correctAnswer: z.string().describe('The correct answer to the question.'),
  explanation: z.string().optional().describe('An optional explanation for the correct answer.'),
});

const GenerateTeacherQuizOutputSchema = z.object({
  title: z.string().describe('The title of the generated quiz.'),
  description: z.string().optional().describe('A brief description or introduction to the quiz.'),
  questions: z.array(QuizQuestionSchema).describe('An array of generated quiz questions.'),
});
export type GenerateTeacherQuizOutput = z.infer<typeof GenerateTeacherQuizOutputSchema>;

// Define the prompt
const quizGeneratorPrompt = ai.definePrompt({
  name: 'teacherQuizGeneratorPrompt',
  input: { schema: GenerateTeacherQuizInputSchema },
  output: { schema: GenerateTeacherQuizOutputSchema },
  prompt: `You are an expert educational quiz generator. Your task is to create a comprehensive quiz based on the provided syllabus or topics.\n\nSyllabus/Topics:
{{{syllabusOrTopics}}}
{{#if syllabusFileUri}}
Source PDF:
{{media url=syllabusFileUri contentType="application/pdf"}}
{{/if}}\n\nQuestion Types: {{{questionTypes}}}\nDifficulty Level: {{{difficulty}}}\nNumber of Questions: {{{numQuestions}}}\n\n{{#if includeKeywords}}\nEnsure the following keywords are included in the quiz: {{{includeKeywords}}}\n{{/if}}\n{{#if excludeKeywords}}\nEnsure the following keywords are explicitly excluded from the quiz: {{{excludeKeywords}}}\n{{/if}}\n\nGenerate a quiz with a clear title and description. Each question should be one of the specified types.\nFor 'MCQ' questions, provide 4 distinct options and clearly mark the 'correctAnswer'.\nFor 'short-answer' and 'conceptual' questions, provide a concise 'correctAnswer' and an optional 'explanation'.\n\nYour output MUST be a JSON object conforming to the following schema:\n`
});

// Define the flow
const teacherQuizGenerationFlow = ai.defineFlow(
  {
    name: 'teacherQuizGenerationFlow',
    inputSchema: GenerateTeacherQuizInputSchema,
    outputSchema: GenerateTeacherQuizOutputSchema,
  },
  async (input) => {
    const { output } = await quizGeneratorPrompt(input);
    return output!;
  }
);

// Wrapper function
export async function generateTeacherQuiz(input: GenerateTeacherQuizInput, options?: { apiKey?: string }): Promise<GenerateTeacherQuizOutput> {
  if (options?.apiKey) {
    const { output } = await quizGeneratorPrompt(input, { config: { apiKey: options.apiKey } });
    return output!;
  }
  return teacherQuizGenerationFlow(input);
}
