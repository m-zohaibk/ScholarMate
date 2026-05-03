'use server';
/**
 * @fileOverview This file implements the Genkit flow for generating structured notes from study material.
 *
 * - generateStructuredNotes - A function that handles the structured notes generation process.
 * - StudentStructuredNotesInput - The input type for the generateStructuredNotes function.
 * - StudentStructuredNotesOutput - The return type for the generateStructuredNotes function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const StudentStructuredNotesInputSchema = z.object({
  studyMaterialDataUri: z
    .string()
    .describe(
      'A data URI of the study material (PDF, PPTX, Image) that must include a MIME type and use Base64 encoding.'
    ),
  detailLevel: z.enum(['summary', 'detailed']).default('detailed').describe('Level of detail for the notes: "summary" or "detailed".'),
  keywordsToFocus: z.array(z.string()).optional().describe('Optional keywords or topics to focus on when generating notes.'),
});
export type StudentStructuredNotesInput = z.infer<typeof StudentStructuredNotesInputSchema>;

const StudentStructuredNotesOutputSchema = z.object({
  title: z.string().describe('The main title for the structured notes.'),
  summary: z.string().describe('A concise summary of the entire study material.'),
  sections: z.array(
    z.object({
      heading: z.string().describe('Main heading for a section of the notes.'),
      subsections: z.array(
        z.object({
          subheading: z.string().describe('Subheading within a section.'),
          points: z.array(z.string()).describe('Key ideas or bullet points under the subheading.'),
        })
      ).describe('List of subsections with their key points.'),
    })
  ).describe('An array of structured sections, each with headings, subheadings, and points.'),
});
export type StudentStructuredNotesOutput = z.infer<typeof StudentStructuredNotesOutputSchema>;

export async function generateStructuredNotes(input: StudentStructuredNotesInput): Promise<StudentStructuredNotesOutput> {
  return studentStructuredNotesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'studentStructuredNotesPrompt',
  input: { schema: StudentStructuredNotesInputSchema },
  output: { schema: StudentStructuredNotesOutputSchema },
  prompt: `You are an AI assistant specialized in generating structured study notes.
Your task is to take the provided study material and organize it into clear, concise, and structured notes.

Instructions:
1. Create a main title for the notes.
2. Provide an overall summary of the study material.
3. Organize the content into logical sections with clear headings and subheadings.
4. Under each subheading, list key ideas and important points as bullet points.

Output Format:
Respond ONLY with a JSON object matching the following schema. Ensure all fields are present and correctly formatted.

Study Material: {{media url=studyMaterialDataUri}}

{{#if keywordsToFocus}}
Focus Keywords/Topics: {{#each keywordsToFocus}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.
{{/if}}

Detail Level: {{{detailLevel}}}
{{#if (eq detailLevel "summary")}}
Prioritize brevity and high-level concepts.
{{else}}
Include comprehensive details, covering all significant aspects mentioned in the material.
{{/if}}
`,
});

const studentStructuredNotesFlow = ai.defineFlow(
  {
    name: 'studentStructuredNotesFlow',
    inputSchema: StudentStructuredNotesInputSchema,
    outputSchema: StudentStructuredNotesOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
