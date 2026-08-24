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
import { MAX_GENERATION_REQUEST_BYTES, preparePdfForUpload } from '@/lib/browser-pdf';
import { parseApiResponse } from '@/lib/api-response';
import { uploadPdfForGemini } from '@/lib/gemini-file-client';
import { MAX_DIRECT_GEMINI_FILE_UPLOAD_BYTES } from '@/lib/document-upload-limits';

function notesAsText(notes: StudentStructuredNotesOutput) {
  return [notes.title, '', notes.summary, '', ...notes.sections.flatMap((section) => [section.heading, ...section.subsections.flatMap((subsection) => [subsection.subheading, ...subsection.points.map((point) => `• ${point}`)])])].join('\n');
}

export default function StudentNotesGenerator() {
  const { toast } = useToast();
  const { firestore, user, isUserLoading } = useFirebase();
  const [loading, setLoading] = useState(false);
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
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please upload a file smaller than 10MB.', variant: 'destructive' });
      return;
    }
    setFileName(file.name);
    setPdfText('');
    setPdfPageImages([]);
    setPdfTotalPages(0);
    setPdfRenderedPages(0);
    setPdfTruncated(false);
    setGeminiFileUri(null);
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read file.'));
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsDataURL(file);
      });
      setFileData(dataUri);
      if (isPdf) {
        if (file.size <= MAX_DIRECT_GEMINI_FILE_UPLOAD_BYTES) {
          try {
            const uploaded = await uploadPdfForGemini(file);
            setGeminiFileUri(uploaded.fileUri);
            return;
          } catch {
            // Fall back to browser PDF.js rendering if the Files API upload is unavailable.
          }
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
    }
  };

  const handleGenerate = async () => {
    if (!fileData) {
      toast({ title: 'Document required', description: 'Please upload a study document first.' });
      return;
    }
    setLoading(true);
    const preparedPdf = geminiFileUri || (pdfText || pdfPageImages.length ? 'data:application/pdf;base64,AA==' : fileData);
    try {
      const requestBody = JSON.stringify({ studyMaterialDataUri: preparedPdf, fileName, mimeType: fileName?.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : fileName?.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : undefined, detailLevel, studyMaterialText: pdfText || undefined, pdfPageImages: pdfText.length <= 40 ? pdfPageImages : undefined });
      const requestBytes = new TextEncoder().encode(requestBody).byteLength;
      if (requestBytes > MAX_GENERATION_REQUEST_BYTES) {
        throw new Error('This document is too large to send safely. Use a smaller or lower-resolution file, or fewer scanned pages.');
      }
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

  return <>
    <div className="max-w-5xl mx-auto space-y-8">
    <div><h1 className="font-headline text-3xl font-bold">AI Structured Notes</h1><p className="text-muted-foreground">Transform complex materials into clear, organized study notes.</p></div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5 space-y-6"><Card className="border-none shadow-sm"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />Input Material</CardTitle></CardHeader><CardContent className="space-y-6"><div className="space-y-2"><Label htmlFor="notes-upload">Study Document (PDF, Image, DOCX, or PPTX)</Label><input id="notes-upload" type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf,image/*,.docx,.pptx" /><button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"><Upload className="w-8 h-8 text-muted-foreground" /><span className="text-center"><span className="font-medium block">{fileName || 'Click to upload document'}</span><span className="text-xs text-muted-foreground mt-1 block">PDF, images, DOCX, or PPTX up to 10MB</span><span className="text-xs text-muted-foreground mt-1 block">{geminiFileUri ? 'PDF uploaded securely to Gemini Files API; native document understanding will be used.' : pdfTotalPages ? `Scanned PDF: ${pdfRenderedPages} of ${pdfTotalPages} page${pdfTotalPages === 1 ? '' : 's'} prepared for OCR${pdfTruncated ? ' due to request limits' : ''}.` : 'Scanned PDFs use Gemini Files API when possible, with browser OCR fallback.'}</span></span></button></div><div className="space-y-3"><Label>Detail Level</Label><Tabs value={detailLevel} onValueChange={(value) => setDetailLevel(value as 'summary' | 'detailed')} className="w-full"><TabsList className="grid w-full grid-cols-2 bg-muted/50"><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="detailed">Detailed</TabsTrigger></TabsList></Tabs></div><Button className="w-full h-12 text-lg font-headline bg-accent hover:bg-accent/90" disabled={loading || !fileData} onClick={() => void handleGenerate()}>{loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Analyzing Document...</> : <><Sparkles className="w-5 h-5 mr-2" />Generate Notes</>}</Button></CardContent></Card><Card className="border-none shadow-sm"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><History className="w-5 h-5 text-primary" />Saved Notes</CardTitle></CardHeader><CardContent className="space-y-2">{savedNotes.length ? savedNotes.slice(0, 5).map((item) => <button key={item.id} type="button" onClick={() => setNotes(item)} className="w-full text-left rounded-lg border p-3 hover:border-primary/40 hover:bg-primary/5"><p className="font-medium truncate">{item.title}</p><p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()} · {item.sourceName}</p></button>) : <p className="text-sm text-muted-foreground">Generated notes will appear here.</p>}</CardContent></Card></div>
      <div className="lg:col-span-7">{!notes ? <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 bg-white/40 rounded-3xl border border-dashed"><div className="bg-muted p-6 rounded-full mb-4"><ListTree className="w-12 h-12 text-muted-foreground" /></div><h3 className="font-headline text-xl font-bold text-muted-foreground">No Notes Yet</h3><p className="text-muted-foreground max-w-xs mx-auto mt-2">Upload your document on the left to generate structured notes using Vision AI.</p></div> : <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500"><div className="flex justify-between items-center mb-4 gap-4"><div><h2 className="font-headline text-2xl font-bold text-primary">{notes.title}</h2><p className="text-xs text-muted-foreground">From {notes.sourceName}</p></div><div className="flex gap-2"><Button variant="outline" size="icon" className="rounded-full" onClick={copyNotes} aria-label="Copy notes"><Copy className="w-4 h-4" /></Button><Button variant="outline" size="icon" className="rounded-full" onClick={downloadNotes} aria-label="Download notes"><Download className="w-4 h-4" /></Button></div></div><Card className="border-none shadow-sm overflow-hidden"><CardHeader className="bg-primary/5 py-4"><div className="flex items-center gap-2 text-primary"><Highlighter className="w-4 h-4" /><span className="font-bold text-xs uppercase tracking-wider">Executive Summary</span></div></CardHeader><CardContent className="pt-4 text-muted-foreground leading-relaxed text-sm">{notes.summary}</CardContent></Card>{notes.sections.map((section) => <div key={section.heading} className="space-y-4"><h3 className="font-headline text-xl font-bold border-b pb-2 text-foreground">{section.heading}</h3><div className="grid gap-4">{section.subsections.map((subsection) => <Card key={subsection.subheading} className="border-none shadow-sm bg-white"><CardHeader className="py-4"><CardTitle className="text-base font-semibold text-accent">{subsection.subheading}</CardTitle></CardHeader><CardContent className="pt-0"><ul className="space-y-3">{subsection.points.map((point) => <li key={point} className="flex gap-3 text-sm leading-relaxed text-muted-foreground"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" /><span>{point}</span></li>)}</ul></CardContent></Card>)}</div></div>)}</div>}</div>
    </div>
    </div>
  </>;
}
