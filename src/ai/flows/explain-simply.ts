'use server';
/**
 * @fileOverview Rewrites a quiz explanation in very simple words, on request.
 * Used by the "Explain simply" button — one small call, only when tapped.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExplainSimplyInputSchema = z.object({
  question: z.string().describe('The quiz question the explanation belongs to.'),
  correctAnswer: z.string().describe('The correct answer to the question.'),
  explanation: z.string().describe('The existing explanation to rewrite simply.'),
});
export type ExplainSimplyInput = z.infer<typeof ExplainSimplyInputSchema>;

const ExplainSimplyOutputSchema = z.object({
  simple: z.string().describe('The explanation rewritten in very simple words, with one everyday example.'),
});
export type ExplainSimplyOutput = z.infer<typeof ExplainSimplyOutputSchema>;

export async function explainSimply(input: ExplainSimplyInput): Promise<ExplainSimplyOutput> {
  return explainSimplyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainSimplyPrompt',
  input: { schema: ExplainSimplyInputSchema },
  output: { schema: ExplainSimplyOutputSchema },
  prompt: `Rewrite the explanation below in very simple, easy words that a beginner student can understand.

Question: {{{question}}}
Correct answer: {{{correctAnswer}}}
Explanation: {{{explanation}}}

Rules:
- Use short sentences and everyday words. Avoid jargon; if a hard word is needed, explain it in brackets.
- Keep it to 2-4 sentences.
- Add one simple real-life example starting with "For example,".
- Stay faithful to the original explanation — do not add new facts.

Respond strictly as one valid JSON object matching the output schema.`,
});

const explainSimplyFlow = ai.defineFlow(
  {
    name: 'explainSimplyFlow',
    inputSchema: ExplainSimplyInputSchema,
    outputSchema: ExplainSimplyOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
