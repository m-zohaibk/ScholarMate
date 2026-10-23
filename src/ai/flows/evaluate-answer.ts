'use server';
/**
 * @fileOverview Grades a student's typed (free-text) answer against the
 * reference answer. Meaning decides the verdict, not exact wording — a
 * correct idea in the student's own words must be marked correct.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EvaluateAnswerInputSchema = z.object({
  question: z.string().describe('The quiz question that was asked.'),
  referenceAnswer: z.string().describe('The correct reference answer for the question.'),
  studentAnswer: z.string().describe("The student's typed answer, in their own words."),
});
export type EvaluateAnswerInput = z.infer<typeof EvaluateAnswerInputSchema>;

const EvaluateAnswerOutputSchema = z.object({
  verdict: z
    .enum(['correct', 'partial', 'incorrect'])
    .describe('correct = the answer covers the key points of the reference; partial = some key points present but incomplete or vague; incorrect = the key points are missing or wrong.'),
  feedback: z
    .string()
    .describe('One or two short sentences for the student: what they got right, and what was missing or wrong. Encouraging, specific, no jargon.'),
});
export type EvaluateAnswerOutput = z.infer<typeof EvaluateAnswerOutputSchema>;

export async function evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluateAnswerOutput> {
  return evaluateAnswerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'evaluateAnswerPrompt',
  input: { schema: EvaluateAnswerInputSchema },
  output: { schema: EvaluateAnswerOutputSchema },
  prompt: `You are a fair exam marker grading a short typed answer.

Question: {{{question}}}
Reference answer: {{{referenceAnswer}}}
Student's answer: {{{studentAnswer}}}

Marking rules:
1. Judge the MEANING, never the wording. A correct idea stated in the student's own words, with different phrasing or simpler language, is CORRECT.
2. Ignore spelling, grammar, and length. A short answer that covers the key points is correct.
3. "correct" = all key points of the reference answer are present in substance.
4. "partial" = at least one key point is present, but an important part is missing, wrong, or too vague to count.
5. "incorrect" = the key points are missing, the answer says the opposite, or it answers a different question.
6. Feedback: one or two short sentences. Name what the student got right first, then exactly what was missing or wrong. Be encouraging and specific.

Respond strictly as one valid JSON object matching the output schema. Do not wrap the response in Markdown fences or add commentary.`,
});

const evaluateAnswerFlow = ai.defineFlow(
  {
    name: 'evaluateAnswerFlow',
    inputSchema: EvaluateAnswerInputSchema,
    outputSchema: EvaluateAnswerOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
