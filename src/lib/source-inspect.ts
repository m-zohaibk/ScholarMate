import { makeId, type StoredSource, type SourceTopic } from './study-store';

/**
 * Client-side document inspection.
 *
 * Reads a document's own structure — page count, per-page text, and the
 * chapter/topic outline a PDF carries inside itself (bookmarks). This is
 * done locally in the browser: no AI call is needed to know what a file
 * contains or how its chapters are laid out.
 */

export type { SourceTopic };

export interface InspectedSource extends StoredSource {
  inspectedAt: string;
}

export interface StudyChunk {
  id: string;
  sourceName: string;
  label: string;
  text: string;
}

/** One generation call stays complete and detailed under this size. */
export const CHUNK_CHAR_LIMIT = 9000;

function cleanText(text: string) {
  return text.replace(/\u0000/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

interface OutlineItem {
  title?: string;
  dest?: string | unknown[] | null;
  items?: OutlineItem[];
}

export async function inspectPdfFile(file: File): Promise<InspectedSource> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const totalPages = pdf.numPages;

  // Per-page text (text layer only — fast, no rendering).
  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    pageTexts.push(pageText);
  }

  // Chapter/topic outline from the PDF's own bookmarks, when present.
  const outlinePoints: Array<{ title: string; page: number }> = [];
  try {
    const outline = (await pdf.getOutline()) as OutlineItem[] | null;
    const walk = async (items: OutlineItem[]) => {
      for (const item of items) {
        const title = (item.title || '').trim();
        let page: number | null = null;
        try {
          const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
          if (Array.isArray(dest) && dest.length) {
            const ref = dest[0];
            if (typeof ref === 'number') page = ref + 1;
            else if (ref) page = (await pdf.getPageIndex(ref as never)) + 1;
          }
        } catch {
          page = null;
        }
        if (title && page && page >= 1 && page <= totalPages) outlinePoints.push({ title, page });
        if (item.items?.length) await walk(item.items);
      }
    };
    if (outline?.length) await walk(outline);
  } catch {
    // No readable outline — the whole-document topic below covers this file.
  }

  const topics: SourceTopic[] = [];
  const seenPages = new Set<number>();
  const sortedPoints = outlinePoints
    .filter((point) => {
      if (seenPages.has(point.page)) return false;
      seenPages.add(point.page);
      return true;
    })
    .sort((a, b) => a.page - b.page)
    .slice(0, 60);

  sortedPoints.forEach((point, index) => {
    const endPage = index + 1 < sortedPoints.length ? sortedPoints[index + 1].page - 1 : totalPages;
    if (endPage >= point.page) {
      topics.push({
        id: makeId('topic'),
        title: point.title,
        startPage: point.page,
        endPage,
      });
    }
  });

  const hasOutline = topics.length > 0;
  if (!hasOutline) {
    topics.push({ id: makeId('topic'), title: 'Whole document', startPage: 1, endPage: totalPages });
  }

  return {
    id: makeId('source'),
    name: file.name,
    kind: 'pdf',
    totalPages,
    topics,
    topicSource: hasOutline ? 'outline' : 'whole',
    pageTexts,
    fullText: cleanText(pageTexts.join('\n\n')),
    inspectedAt: new Date().toISOString(),
  };
}

export async function inspectOfficeFile(file: File): Promise<InspectedSource> {
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read file.')));
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
  const extension = file.name.split('.').pop()?.toLowerCase();
  const response = await fetch('/api/documents/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataUri,
      fileName: file.name,
      mimeType: extension === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || 'The document could not be read.');
  }
  const payload = (await response.json()) as { text?: string };
  const text = cleanText(payload.text || '');
  return {
    id: makeId('source'),
    name: file.name,
    kind: extension === 'docx' ? 'docx' : 'pptx',
    totalPages: 0,
    topics: [{ id: makeId('topic'), title: 'Whole document', startPage: 1, endPage: 1 }],
    topicSource: 'whole',
    pageTexts: [text],
    fullText: text,
    inspectedAt: new Date().toISOString(),
  };
}

export function topicText(source: StoredSource, topic: SourceTopic): string {
  if (source.kind !== 'pdf') return source.fullText;
  return cleanText(source.pageTexts.slice(topic.startPage - 1, topic.endPage).join('\n\n'));
}

function splitLongText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n\n', limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf('. ', limit);
    if (cut < limit * 0.5) cut = limit;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Build generation-sized chunks for the selected topics of one source. */
export function chunksForTopics(source: StoredSource, topics: SourceTopic[]): StudyChunk[] {
  const chunks: StudyChunk[] = [];
  for (const topic of topics) {
    const text = topicText(source, topic);
    if (!text) continue;
    const parts = splitLongText(text, CHUNK_CHAR_LIMIT);
    parts.forEach((part, index) => {
      chunks.push({
        id: makeId('chunk'),
        sourceName: source.name,
        label: parts.length > 1 ? `${topic.title} (part ${index + 1} of ${parts.length})` : topic.title,
        text: part,
      });
    });
  }
  return chunks;
}

/** Build chunks for an explicit page range of a PDF source. */
export function chunksForPageRange(source: StoredSource, startPage: number, endPage: number): StudyChunk[] {
  const start = Math.max(1, startPage);
  const end = Math.min(source.totalPages || endPage, endPage);
  const text = cleanText(source.pageTexts.slice(start - 1, end).join('\n\n'));
  if (!text) return [];
  const parts = splitLongText(text, CHUNK_CHAR_LIMIT);
  return parts.map((part, index) => ({
    id: makeId('chunk'),
    sourceName: source.name,
    label: parts.length > 1 ? `Pages ${start}–${end} (part ${index + 1} of ${parts.length})` : `Pages ${start}–${end}`,
    text: part,
  }));
}

/** Build chunks from a raw block of study text (e.g. a saved note or a handoff). */
export function chunksForText(sourceName: string, label: string, text: string): StudyChunk[] {
  const cleaned = cleanText(text);
  if (!cleaned) return [];
  const parts = splitLongText(cleaned, CHUNK_CHAR_LIMIT);
  return parts.map((part, index) => ({
    id: makeId('chunk'),
    sourceName,
    label: parts.length > 1 ? `${label} (part ${index + 1} of ${parts.length})` : label,
    text: part,
  }));
}

/**
 * Combine chunk texts into one material string for a single generation call
 * (summary notes / quizzes). Each chunk contributes a fair share so every
 * selected topic is represented instead of only the first pages.
 */
export function combinedChunkText(chunks: StudyChunk[], cap = 48000): string {
  if (!chunks.length) return '';
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  if (totalLength <= cap) return chunks.map((chunk) => chunk.text).join('\n\n');
  const share = Math.floor(cap / chunks.length);
  return chunks.map((chunk) => chunk.text.slice(0, share)).join('\n\n');
}
