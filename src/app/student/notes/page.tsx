'use client';

import { useEffect, useRef, useState } from 'react';
import type { StudentStructuredNotesOutput } from '@/ai/flows/student-structured-notes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Sparkles, Loader2, Download, Copy, ListTree, Highlighter, Upload, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getNotes, makeId, saveNote, type StoredNote } from '@/lib/study-store';
import { useFirebase } from '@/firebase';
import { loadNotes, saveNoteToFirestore } from '@/lib/firestore-store';
import { preparePdfForUpload } from '@/lib/browser-pdf';
import { parseApiResponse } from '@/lib/api-response';
import { uploadPdfForGemini } from '@/lib/gemini-file-client';

function notesAsText(notes: StudentStructuredNotesOutput) {
  return [notes.title, '', notes.summary, '', ...notes.sections.flatMap((section) => [section.heading, ...section.subsections.flatMap((subsection) => [subsection.subheading, ...subsection.points.map((point) => `• ${point}`)])])].join('\n');
}

export default function StudentNotesGenerator() {
  const { toast } = useToast();
  const { firestore, user, isUserLoading } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [pdfIngestionLoading, setPdfIngestionLoading] = useState(false);
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfText, setPdfText] = useState('');
  const [pdfPageImages, setPdfPageImages] = useState<string[]>([]);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfRenderedPages, setPdfRenderedPages] = useState(0);
  const [pdfTruncated, setPdfTruncated] = useState(false);
  const [geminiFileUri, setGeminiFileUri] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<'summary' | 'detailed'>('detailed');
  const [notes, setNotes] = useState<StoredNote | null>(null);
  const [savedNotes, setSavedNotes] = useState<StoredNote[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isPdf = file.type === 'application/pdf' || extension === 'pdf';
    const supported = file.type.startsWith('image/') || isPdf || extension === 'docx' || extension === 'pptx';
    if (!supported) {
      toast({ title: 'Unsupported file', description: 'Choose a PDF, image, DOCX, or PPTX file.', variant: 'destructive' });
      return;
    }
    setFileName(file.name);
    setPdfText('');
    setPdfPageImages([]);
    setPdfTotalPages(0);
    setPdfRenderedPages(0);
    setPdfTruncated(false);
    setGeminiFileUri(null);
    setPdfIngestionLoading(isPdf);
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read file.'));
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsDataURL(file);
      });
      setFileData(dataUri);
      if (isPdf) {
        try {
          console.log('[PDF upload] Files API path started:', { fileName: file.name, sizeBytes: file.size });
          const uploaded = await uploadPdfForGemini(file);
          console.log('[PDF upload] Files API path completed:', { fileName: uploaded.fileName, state: uploaded.state, hasFileUri: Boolean(uploaded.fileUri) });
          setGeminiFileUri(uploaded.fileUri);
          return;
        } catch (error) {
          console.error('[PDF upload] Files API path failed; using browser OCR fallback:', { name: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : String(error) });
        }
        const prepared = await preparePdfForUpload(file);
        setPdfText(prepared.text);
        setPdfPageImages(prepared.pageImages);
        setPdfTotalPages(prepared.totalPages);
        setPdfRenderedPages(prepared.renderedPages);
        setPdfTruncated(prepared.truncated);
      }
    } catch (error) {
      setFileData(null);
      toast({ title: 'Could not read file', description: error instanceof Error ? error.message : 'Please choose the file again.', variant: 'destructive' });
    } finally {
      setPdfIngestionLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!fileData) {
      toast({ title: 'Document required', description: 'Please upload a study document first.' });
      return;
    }
    if (pdfIngestionLoading) {
      toast({ title: 'PDF is still preparing', description: 'Wait for the PDF to finish uploading to Gemini Files API.' });
      return;
    }
    if (fileName?.toLowerCase().endsWith('.pdf') && !geminiFileUri && !pdfText && !pdfPageImages.length) {
      toast({ title: 'PDF is not ready', description: 'The PDF must finish uploading to Gemini before Notes can be generated.' });
      return;
    }
    setLoading(true);
    const preparedPdf = geminiFileUri || (pdfText || pdfPageImages.length ? 'data:application/pdf;base64,AA==' : fileData);
    try {
      const requestBody = JSON.stringify({ studyMaterialDataUri: preparedPdf, fileName, mimeType: fileName?.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : fileName?.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : undefined, detailLevel, studyMaterialText: pdfText || undefined, pdfPageImages: pdfText.length <= 40 ? pdfPageImages : undefined });
      const response = await fetch('/api/student/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody });
      const payload = await parseApiResponse<StudentStructuredNotesOutput>(response);
      const result = payload;
      const stored: StoredNote = { ...result, id: makeId('note'), sourceName: fileName || 'Study material', detailLevel, createdAt: new Date().toISOString() };
      saveNote(stored);
      void saveNoteToFirestore(firestore, user, stored).catch(() => undefined);
      setNotes(stored);
      toast({ title: 'Notes generated', description: 'Your structured notes were saved automatically.' });
    } catch (error) {
      toast({ title: 'Generation failed', description: error instanceof Error ? error.message : 'The document could not be analyzed.', variant: 'destructive' });
    } finally {
      setLoading(false);
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
              <div className="space-y-2">
                <Label htmlFor="notes-upload">Study Document (PDF, Image, DOCX, or PPTX)</Label>
                <input id="notes-upload" type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf,image/*,.docx,.pptx" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="group flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-7 transition-all hover:border-primary/40 hover:bg-primary/[0.04] sm:p-8">
                  <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110"><Upload className="size-6" /></span>
                  <span className="text-center">
                    <span className="block font-semibold">{fileName || 'Click to upload document'}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">PDF, images, DOCX, or PPTX with no application size limit</span>
                    <span className="mt-1.5 block text-xs font-medium text-primary">{geminiFileUri ? 'PDF uploaded securely to Gemini Files API; native document understanding will be used.' : pdfTotalPages ? `Scanned PDF: ${pdfRenderedPages} of ${pdfTotalPages} page${pdfTotalPages === 1 ? '' : 's'} prepared for OCR${pdfTruncated ? ' due to request limits' : ''}.` : 'Scanned PDFs use Gemini Files API when possible, with browser OCR fallback.'}</span>
                  </span>
                </button>
              </div>
              <div className="space-y-2.5">
                <Label>Detail Level</Label>
                <Tabs value={detailLevel} onValueChange={(value) => setDetailLevel(value as 'summary' | 'detailed')} className="w-full">
                  <TabsList className="grid h-11 w-full grid-cols-2 rounded-2xl bg-muted/60 p-1"><TabsTrigger value="summary" className="rounded-xl">Summary</TabsTrigger><TabsTrigger value="detailed" className="rounded-xl">Detailed</TabsTrigger></TabsList>
                </Tabs>
              </div>
              <Button className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg shadow-accent/25" disabled={loading || pdfIngestionLoading || !fileData} onClick={() => void handleGenerate()}>
                {pdfIngestionLoading ? <><Loader2 className="mr-2 size-5 animate-spin" />Preparing PDF...</> : loading ? <><Loader2 className="mr-2 size-5 animate-spin" />Analyzing Document...</> : <><Sparkles className="mr-2 size-5" />Generate Notes</>}
              </Button>
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
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">Upload your document to generate structured notes using Vision AI.</p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 space-y-5 duration-500">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate font-headline text-2xl font-bold tracking-tight text-primary">{notes.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">From {notes.sourceName}</p>
                </div>
                <div className="flex shrink-0 gap-2">
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
