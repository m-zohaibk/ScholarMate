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
  studyMaterialText: z.string().optional().describe('Text extracted from a DOCX, PPTX, or text-based PDF. Use this instead of media when available.'),
  documentFormat: z.string().optional().describe('The uploaded document format.'),
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

export async function generateStructuredNotes(input: StudentStructuredNotesInput, options?: { apiKey?: string }): Promise<StudentStructuredNotesOutput> {
  if (options?.apiKey) {
    const { output } = await prompt(input, { config: { apiKey: options.apiKey } });
    return output!;
  }
  return studentStructuredNotesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'studentStructuredNotesPrompt',
  input: { schema: StudentStructuredNotesInputSchema },
  output: { schema: StudentStructuredNotesOutputSchema },
  prompt: `You are an AI assistant specialized in OCR and academic transcription. 
Your primary task is to accurately transcribe and organize content from the provided study material, which may include printed text, handwritten notes, or diagrams.

CRITICAL CAPABILITY: You must perform high-precision OCR. If the material is handwritten, carefully decipher the writing. If it contains images or charts, describe the core information they convey.

Instructions:
1. Create a professional, clear main title.
2. Provide a concise executive summary.
3. Organize content into a hierarchical structure using logical sections and headings.
4. Extract key facts, definitions, and concepts into bullet points.

{{#if studyMaterialText}}
Extracted Study Material Text:
{{{studyMaterialText}}}
{{else}}
Study Material: {{media url=studyMaterialDataUri}}
{{/if}}

{{#if keywordsToFocus}}
Focus Keywords/Topics: {{#each keywordsToFocus}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.
{{/if}}

  Detail Level: {{{detailLevel}}}
If the detail level is summary, prioritize brevity, high-level themes, and core conclusions. If the detail level is detailed, include comprehensive details covering all significant points, definitions, and examples mentioned in the material.

Return only one valid JSON object matching the output schema. Do not wrap it in Markdown fences, add commentary before or after it, or use trailing commas.

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
