'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { BookOpen, FileText, Layers, Loader2, Plus, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { cn } from '@/lib/utils';
import {
  getSources,
  saveSource,
  type StoredSource,
} from '@/lib/study-store';
import { saveSourceToFirestore } from '@/lib/firestore-store';
import {
  chunksForPageRange,
  chunksForTopics,
  combinedChunkText,
  inspectOfficeFile,
  inspectPdfFile,
  type InspectedSource,
  type StudyChunk,
} from '@/lib/source-inspect';
import { preparePdfForUpload } from '@/lib/browser-pdf';
import { uploadPdfForGemini } from '@/lib/gemini-file-client';

/** Material that still travels the original single-file path (scanned PDFs, images). */
export interface MediaMaterial {
  fileName: string;
  fileData: string;
  geminiFileUri: string | null;
  pdfText: string;
  pdfPageImages: string[];
  pdfTotalPages: number;
  pdfRenderedPages: number;
  pdfTruncated: boolean;
}

export interface SourceSelection {
  chunks: StudyChunk[];
  selectedText: string;
  topicTitles: string[];
  sourceNames: string[];
  media: MediaMaterial | null;
  hasMaterial: boolean;
  summary: string;
}

interface SourcePickerProps {
  onChange: (selection: SourceSelection | null) => void;
  /** Preselect a library source (used by page handoffs, e.g. from Weak Areas). */
  initialSourceId?: string;
  initialTopicTitle?: string;
}

interface SourceChoice {
  mode: 'topics' | 'range';
  topicIds: string[];
  range: [number, number];
}

const EMPTY_SELECTION: SourceSelection = {
  chunks: [],
  selectedText: '',
  topicTitles: [],
  sourceNames: [],
  media: null,
  hasMaterial: false,
  summary: '',
};

function defaultChoice(source: StoredSource, focusTopicTitle?: string): SourceChoice {
  let topicIds = source.topics.map((topic) => topic.id);
  if (focusTopicTitle) {
    const match = source.topics.find(
      (topic) => topic.title.toLowerCase() === focusTopicTitle.toLowerCase()
    );
    if (match) topicIds = [match.id];
  }
  return { mode: 'topics', topicIds, range: [1, Math.max(1, source.totalPages)] };
}

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read file.')));
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function SourcePicker({ onChange, initialSourceId, initialTopicTitle }: SourcePickerProps) {
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const [sources, setSources] = useState<InspectedSource[]>([]);
  const [choices, setChoices] = useState<Record<string, SourceChoice>>({});
  const [media, setMedia] = useState<MediaMaterial | null>(null);
  const [library, setLibrary] = useState<StoredSource[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSignature = useRef('');

  useEffect(() => {
    setLibrary(getSources());
  }, [sources]);

  const addInspectedSource = (inspected: InspectedSource, focusTopicTitle?: string) => {
    const stored: StoredSource = {
      id: inspected.id,
      name: inspected.name,
      kind: inspected.kind,
      totalPages: inspected.totalPages,
      topics: inspected.topics,
      topicSource: inspected.topicSource,
      pageTexts: inspected.pageTexts,
      fullText: inspected.fullText,
    };
    saveSource(stored);
    void saveSourceToFirestore(firestore, user, stored).catch(() => undefined);
    setSources((current) => [...current.filter((item) => item.name !== inspected.name), inspected]);
    setChoices((current) => ({ ...current, [inspected.id]: defaultChoice(inspected, focusTopicTitle) }));
  };

  // Preselect a library source handed off from another page (Weak Areas).
  useEffect(() => {
    if (!initialSourceId) return;
    const stored = getSources().find((item) => item.id === initialSourceId);
    if (stored) {
      addInspectedSource({ ...stored, inspectedAt: new Date().toISOString() }, initialTopicTitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSourceId]);

  const handleMediaFile = async (file: File, isPdf: boolean) => {
    if (media) {
      toast({
        title: 'One scanned file at a time',
        description: 'Scanned PDFs and images are processed one at a time. Text-based PDFs, DOCX and PPTX files can be combined freely.',
      });
      return;
    }
    const dataUri = await readAsDataUri(file);
    if (!isPdf) {
      setMedia({ fileName: file.name, fileData: dataUri, geminiFileUri: null, pdfText: '', pdfPageImages: [], pdfTotalPages: 0, pdfRenderedPages: 0, pdfTruncated: false });
      return;
    }
    try {
      const uploaded = await uploadPdfForGemini(file);
      setMedia({ fileName: file.name, fileData: dataUri, geminiFileUri: uploaded.fileUri, pdfText: '', pdfPageImages: [], pdfTotalPages: 0, pdfRenderedPages: 0, pdfTruncated: false });
      return;
    } catch {
      // Fall through to on-device preparation below.
    }
    const prepared = await preparePdfForUpload(file);
    setMedia({
      fileName: file.name,
      fileData: dataUri,
      geminiFileUri: null,
      pdfText: prepared.text,
      pdfPageImages: prepared.pageImages,
      pdfTotalPages: prepared.totalPages,
      pdfRenderedPages: prepared.renderedPages,
      pdfTruncated: prepared.truncated,
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const isPdf = file.type === 'application/pdf' || extension === 'pdf';
      const isOffice = extension === 'docx' || extension === 'pptx';
      const isImage = file.type.startsWith('image/');
      if (!isPdf && !isOffice && !isImage) {
        toast({ title: 'Unsupported file', description: `${file.name}: choose a PDF, image, DOCX, or PPTX file.`, variant: 'destructive' });
        continue;
      }
      setProcessing(file.name);
      try {
        if (isPdf) {
          const inspected = await inspectPdfFile(file);
          if (inspected.fullText.trim().length >= 40) {
            addInspectedSource(inspected);
          } else {
            await handleMediaFile(file, true);
          }
        } else if (isOffice) {
          const inspected = await inspectOfficeFile(file);
          if (inspected.fullText.trim().length >= 40) {
            addInspectedSource(inspected);
          } else {
            toast({ title: 'No readable text', description: `${file.name} did not contain extractable text.`, variant: 'destructive' });
          }
        } else {
          await handleMediaFile(file, false);
        }
      } catch (error) {
        toast({ title: 'Could not read file', description: error instanceof Error ? error.message : `Please choose ${file.name} again.`, variant: 'destructive' });
      } finally {
        setProcessing(null);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selection = useMemo<SourceSelection>(() => {
    const chunks: StudyChunk[] = [];
    const topicTitles: string[] = [];
    const sourceNames: string[] = [];
    let pagesSelected = 0;
    let topicsSelected = 0;

    for (const source of sources) {
      const choice = choices[source.id] || defaultChoice(source);
      sourceNames.push(source.name);
      if (choice.mode === 'range' && source.kind === 'pdf') {
        chunks.push(...chunksForPageRange(source, choice.range[0], choice.range[1]));
        pagesSelected += Math.max(0, choice.range[1] - choice.range[0] + 1);
        topicTitles.push(`Pages ${choice.range[0]}–${choice.range[1]}`);
      } else {
        const selectedTopics = source.topics.filter((topic) => choice.topicIds.includes(topic.id));
        chunks.push(...chunksForTopics(source, selectedTopics));
        topicsSelected += selectedTopics.length;
        for (const topic of selectedTopics) {
          topicTitles.push(topic.title);
          if (source.kind === 'pdf') pagesSelected += topic.endPage - topic.startPage + 1;
        }
      }
    }

    const fileCount = sources.length + (media ? 1 : 0);
    const parts: string[] = [];
    if (fileCount) parts.push(`${fileCount} file${fileCount === 1 ? '' : 's'}`);
    if (topicsSelected) parts.push(`${topicsSelected} topic${topicsSelected === 1 ? '' : 's'}`);
    if (pagesSelected) parts.push(`~${pagesSelected} pages`);
    parts.push('selected');

    return {
      chunks,
      selectedText: combinedChunkText(chunks),
      topicTitles,
      sourceNames,
      media,
      hasMaterial: chunks.length > 0 || media !== null,
      summary: parts.join(' · '),
    };
  }, [sources, choices, media]);

  useEffect(() => {
    const signature = JSON.stringify({
      chunks: selection.chunks.map((chunk) => chunk.id),
      media: selection.media?.fileName || null,
      topics: selection.topicTitles,
    });
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;
    onChange(selection.hasMaterial ? selection : null);
  }, [selection, onChange]);

  const updateChoice = (sourceId: string, patch: Partial<SourceChoice>) => {
    setChoices((current) => ({ ...current, [sourceId]: { ...(current[sourceId] as SourceChoice), ...patch } }));
  };

  const toggleTopic = (source: StoredSource, topicId: string, checked: boolean) => {
    const choice = choices[source.id] || defaultChoice(source);
    const topicIds = checked
      ? [...choice.topicIds, topicId]
      : choice.topicIds.filter((id) => id !== topicId);
    updateChoice(source.id, { topicIds });
  };

  const libraryOnly = library.filter((item) => !sources.some((source) => source.id === item.id || source.name === item.name));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Study Material (PDF, DOCX, PPTX, or image — multiple files allowed)</Label>
        <input
          type="file"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={(event) => void handleFiles(event.target.files)}
          accept="application/pdf,image/*,.docx,.pptx"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group flex w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-6 transition-all hover:border-primary/40 hover:bg-primary/[0.04]"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
            {processing ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          </span>
          <span className="text-center">
            <span className="block text-sm font-semibold">{processing ? `Reading ${processing}…` : 'Click to add study files'}</span>
            <span className="mt-1 block text-xs text-muted-foreground">Attach one file or several — every attached file is included. Chapters are detected automatically.</span>
          </span>
        </button>
      </div>

      {libraryOnly.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <BookOpen className="size-3.5" /> Your source library
          </p>
          <div className="flex flex-wrap gap-2">
            {libraryOnly.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addInspectedSource({ ...item, inspectedAt: new Date().toISOString() })}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-xs font-medium transition-all hover:border-primary/40 hover:text-primary"
              >
                <Plus className="size-3.5" /> {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {sources.map((source) => {
        const choice = choices[source.id] || defaultChoice(source);
        return (
          <div key={source.id} className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-semibold">
                  <FileText className="size-4 shrink-0 text-primary" /> {source.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {source.kind === 'pdf' ? `${source.totalPages} pages · ` : ''}
                  {source.topicSource === 'outline'
                    ? `${source.topics.length} chapters detected inside the file`
                    : 'No chapters inside this file — whole document'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded-xl"
                aria-label={`Remove ${source.name}`}
                onClick={() => {
                  setSources((current) => current.filter((item) => item.id !== source.id));
                  setChoices((current) => {
                    const next = { ...current };
                    delete next[source.id];
                    return next;
                  });
                }}
              >
                <X className="size-4" />
              </Button>
            </div>

            {source.kind === 'pdf' && source.totalPages > 1 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={choice.mode === 'topics' ? 'default' : 'outline'}
                  className="rounded-xl"
                  onClick={() => updateChoice(source.id, { mode: 'topics' })}
                >
                  <Layers className="mr-1.5 size-3.5" /> Chapters / Topics
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={choice.mode === 'range' ? 'default' : 'outline'}
                  className="rounded-xl"
                  onClick={() => updateChoice(source.id, { mode: 'range' })}
                >
                  Page range
                </Button>
              </div>
            )}

            {choice.mode === 'topics' ? (
              <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                {source.topics.map((topic) => (
                  <label
                    key={topic.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors',
                      choice.topicIds.includes(topic.id) ? 'border-primary/30 bg-primary/[0.04]' : 'border-border/50 hover:bg-muted/40'
                    )}
                  >
                    <Checkbox
                      checked={choice.topicIds.includes(topic.id)}
                      onCheckedChange={(checked) => toggleTopic(source, topic.id, checked === true)}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{topic.title}</span>
                    {source.kind === 'pdf' && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        p. {topic.startPage}–{topic.endPage}
                      </span>
                    )}
                  </label>
                ))}
                {source.topicSource === 'whole' && (
                  <p className="px-1 pt-1 text-xs leading-relaxed text-muted-foreground">
                    This file carries no chapter bookmarks, so it is treated as one topic. Page range still works for PDFs.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 px-1">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={source.totalPages}
                    value={choice.range[0]}
                    onChange={(event) => {
                      const start = Math.min(Math.max(1, Number(event.target.value) || 1), choice.range[1]);
                      updateChoice(source.id, { range: [start, choice.range[1]] });
                    }}
                    className="h-10 w-20 rounded-xl text-center"
                    aria-label="Start page"
                  />
                  <Slider
                    value={choice.range}
                    min={1}
                    max={source.totalPages}
                    step={1}
                    onValueChange={(value) => {
                      if (value.length === 2) updateChoice(source.id, { range: [value[0], value[1]] });
                    }}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={source.totalPages}
                    value={choice.range[1]}
                    onChange={(event) => {
                      const end = Math.max(Math.min(source.totalPages, Number(event.target.value) || source.totalPages), choice.range[0]);
                      updateChoice(source.id, { range: [choice.range[0], end] });
                    }}
                    className="h-10 w-20 rounded-xl text-center"
                    aria-label="End page"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Pages {choice.range[0]}–{choice.range[1]} of {source.totalPages} will be used.
                </p>
              </div>
            )}
          </div>
        );
      })}

      {media && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-semibold">
              <FileText className="size-4 shrink-0 text-primary" /> {media.fileName}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {media.geminiFileUri
                ? 'Scanned/image file uploaded securely; the whole document will be used.'
                : media.pdfTotalPages
                  ? `Scanned PDF: ${media.pdfRenderedPages} of ${media.pdfTotalPages} pages prepared for OCR${media.pdfTruncated ? ' due to request limits' : ''}. The whole document will be used.`
                  : 'Image file; the whole document will be used.'}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-xl" aria-label={`Remove ${media.fileName}`} onClick={() => setMedia(null)}>
            <X className="size-4" />
          </Button>
        </div>
      )}

      {selection.hasMaterial && (
        <p className="rounded-xl bg-primary/[0.06] px-3 py-2 text-center text-xs font-semibold text-primary">
          {selection.summary}
          {media && sources.length > 0 ? ' · plus the scanned/image file above' : ''}
        </p>
      )}
    </div>
  );
}
