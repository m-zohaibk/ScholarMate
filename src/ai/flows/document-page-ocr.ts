import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DocumentPageOcrInputSchema = z.object({
  imageDataUri: z.string().describe('A PNG page image data URI containing a scanned document page.'),
  pageNumber: z.number().int().positive().describe('The page number being transcribed.'),
});

const DocumentPageOcrOutputSchema = z.object({
  text: z.string().describe('The faithfully transcribed text from the page.'),
});

const pageOcrPrompt = ai.definePrompt({
  name: 'documentPageOcrPrompt',
  input: { schema: DocumentPageOcrInputSchema },
  output: { schema: DocumentPageOcrOutputSchema },
  prompt: `You are a high-precision academic OCR engine.

Transcribe the scanned page exactly and completely. Preserve headings, paragraphs, lists, equations, labels, and table content as readable plain text. Correct obvious OCR confusion only when the visual evidence is clear. Do not summarize, invent missing words, or omit handwritten content. For diagrams, include a concise textual description of labels and relationships. If a region is unreadable, write [illegible] rather than guessing.

Page number: {{{pageNumber}}}

Page image:
{{media url=imageDataUri}}`,
});

const documentPageOcrFlow = ai.defineFlow(
  {
    name: 'documentPageOcrFlow',
    inputSchema: DocumentPageOcrInputSchema,
    outputSchema: DocumentPageOcrOutputSchema,
  },
  async (input) => {
    const { output } = await pageOcrPrompt(input);
    return output!;
  },
);

export async function ocrDocumentPage(input: z.infer<typeof DocumentPageOcrInputSchema>) {
  return documentPageOcrFlow(input);
}
