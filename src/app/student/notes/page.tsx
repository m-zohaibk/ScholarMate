'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StudentStructuredNotesOutput } from '@/ai/flows/student-structured-notes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Sparkles, Loader2, Download, Copy, ListTree, Highlighter, History, PenTool, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getNotes, makeId, saveNote, setStudySeed, takeStudySeed, type StoredNote } from '@/lib/study-store';
import { useFirebase } from '@/firebase';
import { loadNotes, saveNoteToFirestore } from '@/lib/firestore-store';
import { fetchJsonWithRetry } from '@/lib/api-response';
import { GenerationProgress } from '@/components/GenerationProgress';
import { SourcePicker, type SourceSelection } from '@/components/SourcePicker';
import { chunksForText, type StudyChunk } from '@/lib/source-inspect';

function notesAsText(notes: StudentStructuredNotesOutput) {
  return [notes.title, '', notes.summary, '', ...notes.sections.flatMap((section) => [section.heading, ...section.subsections.flatMap((subsection) => [subsection.subheading, ...subsection.points.map((point) => `• ${point}`)])])].join('\n');
}

type NoteSection = StudentStructuredNotesOutput['sections'][number];

/** A one-page revision sheet collected locally from the generated points — no extra AI call. */
function buildRevisionSection(sections: NoteSection[]): NoteSection | null {
  const subsections = sections
    .map((section) => ({
      subheading: section.heading,
      points: section.subsections.flatMap((subsection) => subsection.points).slice(0, 3),
    }))
    .filter((subsection) => subsection.points.length)
    .slice(0, 8);
  if (!subsections.length) return null;
  return { heading: 'Quick Revision Sheet', subsections };
}

const TEXT_PLACEHOLDER_URI = 'data:application/pdf;base64,AA==';

export default function StudentNotesGenerator() {
  const { toast } = useToast();
  const router = useRouter();
  const { firestore, user, isUserLoading } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [selection, setSelection] = useState<SourceSelection | null>(null);
  const [seedMaterial, setSeedMaterial] = useState<{ label: string; text: string } | null>(null);
  const [pickerSeed, setPickerSeed] = useState<{ sourceId: string; topicTitle?: string } | null>(null);
  const [detailLevel, setDetailLevel] = useState<'summary' | 'detailed'>('detailed');
  const [notes, setNotes] = useState<StoredNote | null>(null);
  const [savedNotes, setSavedNotes] = useState<StoredNote[]>([]);
  const seedConsumed = useRef(false);

  useEffect(() => {
    const refresh = () => setSavedNotes(getNotes());
    refresh();
    window.addEventListener('scholarmate:changed', refresh);
    return () => window.removeEventListener('scholarmate:changed', refresh);
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) return;
    loadNotes(firestore, user).then((remoteNotes) => {
      if (remoteNotes.length) {
        setSavedNotes(remoteNotes);
      }
    }).catch(() => undefined);
  }, [firestore, isUserLoading, user]);

  // One-shot handoffs (e.g. "Revision notes" from the Weak Areas page).
  useEffect(() => {
    if (seedConsumed.current) return;
    seedConsumed.current = true;
    const seed = takeStudySeed('notes');
    if (!seed) return;
    if (seed.sourceId) {
      setPickerSeed({ sourceId: seed.sourceId, topicTitle: seed.topicTitle });
      toast({ title: 'Material selected for you', description: seed.label });
    } else if (seed.text) {
      setSeedMaterial({ label: seed.label, text: seed.text });
      toast({ title: 'Material ready', description: seed.label });
    }
  }, [toast]);

  // Warm the generation function while the student picks material, so the
  // first Generate click never pays the cold-start cost.
  useEffect(() => {
    fetch('/api/student/notes').catch(() => undefined);
  }, []);

  const handleSelectionChange = useCallback((next: SourceSelection | null) => {
    setSelection(next);
  }, []);

  const requestChunkNotes = async (chunk: StudyChunk): Promise<StudentStructuredNotesOutput> => {
    // No retry here: generateDetailedFromChunks already retries a failed part once.
    return fetchJsonWithRetry<StudentStructuredNotesOutput>(
      '/api/student/notes',
      {
        studyMaterialDataUri: TEXT_PLACEHOLDER_URI,
        fileName: chunk.sourceName,
        detailLevel: 'detailed',
        keywordsToFocus: [chunk.label],
        studyMaterialText: chunk.text,
      },
      { retries: 0 }
    );
  };

  /** Detailed-complete generation: one call per part, then the parts are joined as-is. */
  const generateDetailedFromChunks = async (chunks: StudyChunk[]) => {
    const outputs: StudentStructuredNotesOutput[] = [];
    const failed: string[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      setProgress({ done: index, total: chunks.length, label: chunk.label });
      try {
        outputs.push(await requestChunkNotes(chunk));
      } catch {
        try {
          outputs.push(await requestChunkNotes(chunk));
        } catch {
          failed.push(chunk.label);
        }
      }
    }
    setProgress({ done: chunks.length, total: chunks.length, label: '' });
    if (!outputs.length) {
      throw new Error('The document could not be analyzed. Please try again.');
    }
    const sections = outputs.flatMap((output) => output.sections);
    const revision = buildRevisionSection(sections);
    return {
      title: outputs[0].title,
      summary: outputs.map((output) => output.summary).filter(Boolean).join(' '),
      sections: revision ? [...sections, revision] : sections,
      failed,
    };
  };

  const generateSummaryFromText = async (text: string, fileName: string) => {
    return fetchJsonWithRetry<StudentStructuredNotesOutput>('/api/student/notes', {
      studyMaterialDataUri: TEXT_PLACEHOLDER_URI,
      fileName,
      detailLevel: 'summary',
      studyMaterialText: text.slice(0, 48000),
    });
  };

  const generateFromMedia = async () => {
    const media = selection?.media;
    if (!media) throw new Error('No document selected.');
    const preparedPdf = media.geminiFileUri || (media.pdfText || media.pdfPageImages.length ? TEXT_PLACEHOLDER_URI : media.fileData);
    return fetchJsonWithRetry<StudentStructuredNotesOutput>('/api/student/notes', {
      studyMaterialDataUri: preparedPdf,
      fileName: media.fileName,
      mimeType: media.fileName?.endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : media.fileName?.endsWith('.pptx')
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : undefined,
      detailLevel,
      studyMaterialText: media.pdfText || undefined,
      pdfPageImages: media.pdfText.length <= 40 ? media.pdfPageImages : undefined,
    });
  };

  const handleGenerate = async () => {
    const chunks = seedMaterial
      ? chunksForText(seedMaterial.label, seedMaterial.label, seedMaterial.text)
      : selection?.chunks || [];
    const hasMedia = !seedMaterial && Boolean(selection?.media);

    if (!chunks.length && !hasMedia) {
      toast({ title: 'Document required', description: 'Please add a study document and keep at least one topic selected.' });
      return;
    }

    setLoading(true);
    setProgress(null);
    try {
      let result: StudentStructuredNotesOutput & { failed?: string[] };
      let sourceName: string;
      if (chunks.length && detailLevel === 'detailed') {
        result = await generateDetailedFromChunks(chunks);
        sourceName = seedMaterial?.label || selection?.sourceNames.join(', ') || 'Study material';
      } else if (chunks.length) {
        result = await generateSummaryFromText(selection?.selectedText || chunks.map((chunk) => chunk.text).join('\n\n'), chunks[0].sourceName);
        sourceName = seedMaterial?.label || selection?.sourceNames.join(', ') || 'Study material';
      } else {
        result = await generateFromMedia();
        sourceName = selection?.media?.fileName || 'Study material';
      }

      const stored: StoredNote = { ...result, id: makeId('note'), sourceName, detailLevel, createdAt: new Date().toISOString() };
      saveNote(stored);
      void saveNoteToFirestore(firestore, user, stored).catch(() => undefined);
      setNotes(stored);
      if (result.failed?.length) {
        toast({
          title: 'Notes generated with gaps',
          description: `These parts could not be generated: ${result.failed.join('; ')}. Everything else is complete — try generating again for the missing parts.`,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Notes generated', description: 'Your structured notes were saved automatically.' });
      }
    } catch (error) {
      toast({ title: 'Generation failed', description: error instanceof Error ? error.message : 'The document could not be analyzed.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const copyNotes = async () => {
    if (!notes) return;
    try {
      await navigator.clipboard.writeText(notesAsText(notes));
      toast({ title: 'Copied', description: 'Notes copied to your clipboard.' });
    } catch {
      toast({ title: 'Copy unavailable', description: 'Your browser blocked clipboard access.' });
    }
  };

  const downloadNotes = () => {
    if (!notes) return;
    const blob = new Blob([notesAsText(notes)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${notes.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'study-notes'}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const createQuizFromNotes = () => {
    if (!notes) return;
    setStudySeed({ target: 'quiz', label: `Quiz from notes: ${notes.title}`, text: notesAsText(notes), topic: notes.title });
    router.push('/student/quizzes');
  };

  const canGenerate = Boolean(seedMaterial || selection?.hasMaterial);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
      <div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <Sparkles className="size-3" /> AI Notes
        </p>
        <h1 className="mt-2.5 font-headline text-3xl font-bold tracking-tight sm:text-4xl">AI Structured Notes</h1>
        <p className="mt-1.5 text-muted-foreground">Transform complex materials into clear, organized study notes.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-5 lg:col-span-5">
          <Card className="overflow-hidden border-border/60">
            <CardHeader className="border-b border-border/60 bg-primary/[0.04] pb-4">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="size-4" /></span>
                Input Material
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-6">
              {seedMaterial ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Material handed over for revision</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{seedMaterial.label}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-xl" aria-label="Clear handed-over material" onClick={() => setSeedMaterial(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <SourcePicker
                  onChange={handleSelectionChange}
                  initialSourceId={pickerSeed?.sourceId}
                  initialTopicTitle={pickerSeed?.topicTitle}
                />
              )}
              <div className="space-y-2.5">
                <Label>Detail Level</Label>
                <Tabs value={detailLevel} onValueChange={(value) => setDetailLevel(value as 'summary' | 'detailed')} className="w-full">
                  <TabsList className="grid h-11 w-full grid-cols-2 rounded-2xl bg-muted/60 p-1"><TabsTrigger value="summary" className="rounded-xl">Summary</TabsTrigger><TabsTrigger value="detailed" className="rounded-xl">Detailed</TabsTrigger></TabsList>
                </Tabs>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {detailLevel === 'summary'
                    ? 'One fast pass over the selected material — the main points only.'
                    : 'Complete notes in easy wording, generated part by part so almost nothing is missed. Takes longer on big documents.'}
                </p>
              </div>
              <Button className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg shadow-accent/25" disabled={loading || !canGenerate} onClick={() => void handleGenerate()}>
                {loading ? <><Loader2 className="mr-2 size-5 animate-spin" />{progress ? `Generating part ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : 'Analyzing Document...'}</> : <><Sparkles className="mr-2 size-5" />Generate Notes</>}
              </Button>
              {loading && (
                <GenerationProgress
                  title={progress && progress.total > 1 ? `Generating part ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : 'Generating your notes'}
                  hint={progress && progress.total > 1
                    ? `${progress.done} of ${progress.total} parts complete${progress.label ? ` — now: ${progress.label}` : ''}. Finished parts are kept, even if one needs another try.`
                    : 'Reading your material and writing structured notes. The first generation after a while can take up to a minute.'}
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent"><History className="size-4" /></span>
                Saved Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {savedNotes.length ? savedNotes.slice(0, 5).map((item) => (
                <button key={item.id} type="button" onClick={() => setNotes(item)} className="w-full rounded-2xl border border-border/60 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()} · {item.sourceName}</p>
                </button>
              )) : <p className="rounded-2xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">Generated notes will appear here.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          {!notes ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-white/40 p-8 text-center sm:min-h-[500px]">
              <span className="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10"><ListTree className="size-9 text-primary" /></span>
              <h3 className="mt-5 font-headline text-xl font-bold">No Notes Yet</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">Add your documents, pick the chapters you need, and generate structured notes.</p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 space-y-5 duration-500">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate font-headline text-2xl font-bold tracking-tight text-primary">{notes.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">From {notes.sourceName}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" className="rounded-2xl" onClick={createQuizFromNotes}>
                    <PenTool className="mr-2 size-4" /> Create quiz from these notes
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-2xl" onClick={copyNotes} aria-label="Copy notes"><Copy className="size-4" /></Button>
                  <Button variant="outline" size="icon" className="rounded-2xl" onClick={downloadNotes} aria-label="Download notes"><Download className="size-4" /></Button>
                </div>
              </div>
              <Card className="overflow-hidden border-primary/15">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 py-3.5">
                  <div className="flex items-center gap-2 text-primary"><Highlighter className="size-4" /><span className="text-xs font-bold uppercase tracking-wider">Executive Summary</span></div>
                </CardHeader>
                <CardContent className="pt-4 text-sm leading-relaxed text-muted-foreground">{notes.summary}</CardContent>
              </Card>
              {notes.sections.map((section) => (
                <div key={section.heading} className="space-y-3.5">
                  <h3 className="flex items-center gap-2.5 font-headline text-xl font-bold tracking-tight">
                    <span className="h-6 w-1.5 rounded-full bg-gradient-to-b from-primary to-accent" />{section.heading}
                  </h3>
                  <div className="grid gap-3.5">
                    {section.subsections.map((subsection) => (
                      <Card key={subsection.subheading} className="border-border/60 bg-white/70">
                        <CardHeader className="pb-2.5 pt-4"><CardTitle className="text-[15px] font-semibold text-accent">{subsection.subheading}</CardTitle></CardHeader>
                        <CardContent className="pt-0">
                          <ul className="space-y-2.5">
                            {subsection.points.map((point) => (
                              <li key={point} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" /><span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
