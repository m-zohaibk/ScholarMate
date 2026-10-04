'use client';

import { useEffect, useRef, useState } from 'react';
import type { GenerateTeacherQuizOutput } from '@/ai/flows/teacher-quiz-generation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Plus, X, CheckCircle2, Download, Save, Globe2, FileUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getQuizzes, makeId, saveQuiz, type StoredQuiz } from '@/lib/study-store';
import { useFirebase } from '@/firebase';
import { loadPersonalQuizzes, savePublishedQuizToFirestore, saveQuizToFirestore } from '@/lib/firestore-store';
import { cn } from '@/lib/utils';
import { uploadPdfForGemini } from '@/lib/gemini-file-client';

export default function TeacherQuizGenerator() {
  const { toast } = useToast();
  const { firestore, user, isUserLoading } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [syllabus, setSyllabus] = useState('');
  const [syllabusFileUri, setSyllabusFileUri] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [generatedQuiz, setGeneratedQuiz] = useState<GenerateTeacherQuizOutput | null>(null);
  const [quizId, setQuizId] = useState('');
  const [published, setPublished] = useState(false);
  const [savedQuizzes, setSavedQuizzes] = useState<StoredQuiz[]>([]);
  const syllabusFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => setSavedQuizzes(getQuizzes().filter((quiz) => quiz.source === 'teacher'));
    refresh();
    window.addEventListener('scholarmate:changed', refresh);
    return () => window.removeEventListener('scholarmate:changed', refresh);
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) return;
    loadPersonalQuizzes(firestore, user).then((remoteQuizzes) => {
      const teacherQuizzes = remoteQuizzes.filter((quiz) => quiz.source === 'teacher');
      if (teacherQuizzes.length) setSavedQuizzes(teacherQuizzes);
    }).catch(() => undefined);
  }, [firestore, isUserLoading, user]);

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !includeTags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setIncludeTags([...includeTags, tag]);
      setTagInput('');
    }
  };

  const handleSyllabusFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const supported = ['txt', 'md', 'pdf', 'docx', 'pptx'].includes(extension || '');
    if (!supported) {
      toast({ title: 'Unsupported file', description: 'Choose a text, PDF, DOCX, or PPTX syllabus.', variant: 'destructive' });
      return;
    }
    if (extension === 'pdf') {
      void uploadPdfForGemini(file).then((uploaded) => {
        setSyllabusFileUri(uploaded.fileUri);
        setSyllabus('Attached PDF document');
        toast({ title: 'PDF imported', description: `${file.name} is ready for quiz generation.` });
      }).catch((error) => {
        toast({ title: 'Import failed', description: error instanceof Error ? error.message : 'Could not upload this PDF.', variant: 'destructive' });
      });
      return;
    }
    setSyllabusFileUri(null);
    const reader = new FileReader();
    reader.onerror = () => toast({ title: 'Could not read file', description: 'Please choose the file again.', variant: 'destructive' });
    reader.onload = async () => {
      try {
        if (extension === 'txt' || extension === 'md') {
          setSyllabus(typeof reader.result === 'string' ? reader.result : '');
        } else {
          const dataUri = typeof reader.result === 'string' ? reader.result : '';
          const response = await fetch('/api/documents/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUri, fileName: file.name, mimeType: file.type }) });
          const payload = await response.json() as { text?: string; error?: string; isScannedPdf?: boolean };
          if (!response.ok) throw new Error(payload.error || 'Could not extract document text.');
          if (!payload.text?.trim()) throw new Error(payload.isScannedPdf ? 'This PDF appears to be scanned. Please paste its text or use the Student OCR workflow.' : 'No readable text was found in this file.');
          setSyllabus(payload.text);
        }
        toast({ title: 'Syllabus imported', description: `${file.name} is ready for quiz generation.` });
      } catch (error) {
        toast({ title: 'Import failed', description: error instanceof Error ? error.message : 'Could not extract this document.', variant: 'destructive' });
      }
    };
    if (extension === 'txt' || extension === 'md') reader.readAsText(file);
    else reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    const input = syllabus.trim();
    if (!input && !syllabusFileUri) {
      toast({ title: 'Input required', description: 'Enter a syllabus or list of topics.' });
      return;
    }
    const count = Math.min(20, Math.max(1, Number.isFinite(numQuestions) ? numQuestions : 5));
    setNumQuestions(count);
    setLoading(true);
    try {
      const response = await fetch('/api/teacher/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ syllabusOrTopics: input || 'Generate from the attached PDF document.', syllabusFileUri: syllabusFileUri || undefined, difficulty, numQuestions: count, questionTypes: ['MCQ', 'conceptual', 'short-answer'], includeKeywords: includeTags }) });
      const errorPayload = await response.clone().json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(errorPayload.error || 'quiz-generation-failed');
      const result = await response.json() as GenerateTeacherQuizOutput;
      const id = makeId('teacher-quiz');
      setQuizId(id);
      setPublished(false);
      setGeneratedQuiz(result);
      const savedQuiz: StoredQuiz = { id, title: result.title, description: result.description, questions: result.questions, source: 'teacher', creator: 'teacher', published: false, createdAt: new Date().toISOString() };
      saveQuiz(savedQuiz);
      void saveQuizToFirestore(firestore, user, savedQuiz).catch(() => undefined);
      toast({ title: 'Quiz generated', description: 'Saved as a draft. Review it before publishing.' });
    } catch (error) {
      toast({ title: 'Generation failed', description: error instanceof Error ? error.message : 'Please check the syllabus and try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updatePublication = () => {
    if (!generatedQuiz || !quizId) return;
    const next = !published;
    const updatedQuiz: StoredQuiz = { id: quizId, title: generatedQuiz.title, description: generatedQuiz.description, questions: generatedQuiz.questions, source: 'teacher', creator: 'teacher', published: next, createdAt: new Date().toISOString() };
    saveQuiz(updatedQuiz);
    void saveQuizToFirestore(firestore, user, updatedQuiz).catch(() => undefined);
    void savePublishedQuizToFirestore(firestore, user, updatedQuiz).catch(() => undefined);
    setPublished(next);
    toast({ title: next ? 'Quiz published' : 'Quiz unpublished', description: next ? 'Students can now access this quiz.' : 'The quiz is back in drafts.' });
  };

  const loadQuiz = (quiz: StoredQuiz) => {
    setQuizId(quiz.id);
    setGeneratedQuiz({ title: quiz.title, description: quiz.description, questions: quiz.questions as GenerateTeacherQuizOutput['questions'] });
    setPublished(quiz.published);
  };

  const exportPdf = () => {
    if (!generatedQuiz) return;
    window.print();
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
      <div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
          <Sparkles className="size-3" /> Assessment builder
        </p>
        <h1 className="mt-2.5 font-headline text-3xl font-bold tracking-tight sm:text-4xl">AI Quiz Generator</h1>
        <p className="mt-1.5 text-muted-foreground">Create, review, save, and publish assessments aligned with your curriculum.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-5 lg:col-span-1">
          <Card className="overflow-hidden border-border/60">
            <CardHeader className="border-b border-border/60 bg-accent/[0.05] pb-4">
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={(value) => setDifficulty(value as typeof difficulty)}>
                  <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="question-count">Questions Count</Label>
                <Input id="question-count" type="number" min={1} max={20} className="h-11 rounded-2xl" value={Number.isFinite(numQuestions) ? numQuestions : ''} onChange={(event) => setNumQuestions(Number(event.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Focus Keywords</Label>
                <div className="flex gap-2">
                  <Input placeholder="e.g. DNA" className="h-11 rounded-2xl" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddTag(); } }} />
                  <Button type="button" variant="secondary" size="icon" className="h-11 w-11 shrink-0 rounded-2xl" onClick={handleAddTag} aria-label="Add keyword"><Plus className="size-4" /></Button>
                </div>
                {includeTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {includeTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 rounded-full py-1 pl-3 pr-1.5">{tag}
                        <button type="button" aria-label={`Remove ${tag}`} onClick={() => setIncludeTags(includeTags.filter((item) => item !== tag))} className="grid size-5 place-items-center rounded-full hover:bg-black/10"><X className="size-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card id="published" className="scroll-mt-24 border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Saved Drafts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {savedQuizzes.length ? savedQuizzes.map((quiz) => (
                <button type="button" key={quiz.id} onClick={() => loadQuiz(quiz)} className="w-full rounded-2xl border border-border/60 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <p className="truncate text-sm font-semibold">{quiz.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{quiz.published ? 'Published' : 'Draft'} · {quiz.questions.length} questions</p>
                </button>
              )) : <p className="rounded-2xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">Generated quizzes will appear here.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Card id="syllabus" className="scroll-mt-24 overflow-hidden border-border/60">
            <CardHeader className="border-b border-border/60 bg-primary/[0.04] pb-4">
              <CardTitle className="text-base">Syllabus / Topics</CardTitle>
              <CardDescription>Paste your syllabus or import a text, PDF, DOCX, or PPTX file. PDFs are uploaded to Gemini Files API without an application size or page limit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <input ref={syllabusFileRef} type="file" accept=".txt,.md,.pdf,.docx,.pptx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="hidden" onChange={handleSyllabusFile} />
              <Button type="button" variant="outline" className="h-auto min-h-12 w-full rounded-2xl border-2 border-dashed py-3.5" onClick={() => syllabusFileRef.current?.click()}>
                <FileUp className="mr-2 size-4 shrink-0" /> Import syllabus document
              </Button>
              <Textarea placeholder="Enter syllabus details here..." className="min-h-[180px] rounded-2xl border-2 border-dashed bg-muted/30 sm:min-h-[200px]" value={syllabus} onChange={(event) => setSyllabus(event.target.value)} />
              <Button className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/25" disabled={loading || !syllabus.trim()} onClick={() => void handleGenerate()}>
                {loading ? <><Loader2 className="mr-2 size-5 animate-spin" />Generating...</> : <><Sparkles className="mr-2 size-5" />Generate Quiz</>}
              </Button>
            </CardContent>
          </Card>

          {generatedQuiz && (
            <Card className="overflow-hidden border-border/60 shadow-xl shadow-primary/5 print:shadow-none">
              <CardHeader className="border-b border-border/60 bg-gradient-to-r from-primary/10 to-accent/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="font-headline text-xl sm:text-2xl">{generatedQuiz.title}</CardTitle>
                    {generatedQuiz.description && <CardDescription className="mt-1">{generatedQuiz.description}</CardDescription>}
                  </div>
                  <div className="flex shrink-0 gap-2 print:hidden">
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={exportPdf}><Download className="mr-1.5 size-4" />Export PDF</Button>
                    <Button size="sm" variant={published ? 'secondary' : 'default'} className="rounded-xl" onClick={updatePublication}>
                      {published ? <><Globe2 className="mr-1.5 size-4" />Unpublish</> : <><Save className="mr-1.5 size-4" />Publish</>}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-7 p-5 pt-6 sm:p-7">
                {generatedQuiz.questions.map((question, index) => (
                  <div key={`${question.questionText}-${index}`} className="space-y-3 border-b border-border/60 pb-6 last:border-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</span>
                      <p className="pt-0.5 text-[15px] font-medium leading-snug sm:text-base">{question.questionText}</p>
                    </div>
                    {question.options ? (
                      <div className="grid grid-cols-1 gap-2.5 pl-11 sm:grid-cols-2">
                        {question.options.map((option) => (
                          <div key={option} className={cn('rounded-2xl border p-3 text-sm', option === question.correctAnswer ? 'border-emerald-300 bg-emerald-50 font-medium text-emerald-700' : 'bg-muted/40')}>{option}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="ml-11 rounded-2xl bg-muted/40 p-4 text-sm italic">
                        <span className="mb-1 block text-[11px] font-bold not-italic uppercase tracking-wider text-muted-foreground">Answer Key</span>{question.correctAnswer}
                      </div>
                    )}
                    {question.explanation && (
                      <div className="ml-11 mt-1 flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>{question.explanation}</span>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
