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

export default function TeacherQuizGenerator() {
  const { toast } = useToast();
  const { firestore, user, isUserLoading } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [syllabus, setSyllabus] = useState('');
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
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Use a syllabus file smaller than 10MB.', variant: 'destructive' });
      return;
    }
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
    if (!input) {
      toast({ title: 'Input required', description: 'Enter a syllabus or list of topics.' });
      return;
    }
    const count = Math.min(20, Math.max(1, Number.isFinite(numQuestions) ? numQuestions : 5));
    setNumQuestions(count);
    setLoading(true);
    try {
      const response = await fetch('/api/teacher/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ syllabusOrTopics: input, difficulty, numQuestions: count, questionTypes: ['MCQ', 'conceptual', 'short-answer'], includeKeywords: includeTags }) });
      if (!response.ok) throw new Error('quiz-generation-failed');
      const result = await response.json() as GenerateTeacherQuizOutput;
      const id = makeId('teacher-quiz');
      setQuizId(id);
      setPublished(false);
      setGeneratedQuiz(result);
      const savedQuiz: StoredQuiz = { id, title: result.title, description: result.description, questions: result.questions, source: 'teacher', creator: 'teacher', published: false, createdAt: new Date().toISOString() };
      saveQuiz(savedQuiz);
      void saveQuizToFirestore(firestore, user, savedQuiz).catch(() => undefined);
      toast({ title: 'Quiz generated', description: 'Saved as a draft. Review it before publishing.' });
    } catch {
      toast({ title: 'Generation failed', description: 'Please check the syllabus and try again.', variant: 'destructive' });
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

  return <div className="max-w-5xl mx-auto space-y-8">
    <div><h1 className="font-headline text-3xl font-bold">AI Quiz Generator</h1><p className="text-muted-foreground">Create, review, save, and publish assessments aligned with your curriculum.</p></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6"><Card className="border-none shadow-sm"><CardHeader><CardTitle className="text-lg">Configuration</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Difficulty</Label><Select value={difficulty} onValueChange={(value) => setDifficulty(value as typeof difficulty)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="question-count">Questions Count</Label><Input id="question-count" type="number" min={1} max={20} value={Number.isFinite(numQuestions) ? numQuestions : ''} onChange={(event) => setNumQuestions(Number(event.target.value))} /></div><div className="space-y-2"><Label>Focus Keywords</Label><div className="flex gap-2"><Input placeholder="e.g. DNA" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddTag(); } }} /><Button type="button" variant="secondary" size="icon" onClick={handleAddTag} aria-label="Add keyword"><Plus className="w-4 h-4" /></Button></div><div className="flex flex-wrap gap-2 mt-2">{includeTags.map((tag) => <Badge key={tag} variant="secondary" className="pl-2 pr-1 gap-1">{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => setIncludeTags(includeTags.filter((item) => item !== tag))}><X className="w-3 h-3" /></button></Badge>)}</div></div></CardContent></Card><Card className="border-none shadow-sm"><CardHeader><CardTitle className="text-lg">Saved Drafts</CardTitle></CardHeader><CardContent className="space-y-2">{savedQuizzes.length ? savedQuizzes.map((quiz) => <button type="button" key={quiz.id} onClick={() => loadQuiz(quiz)} className="w-full text-left rounded-lg border p-3 hover:border-primary/40 hover:bg-primary/5"><p className="font-medium truncate">{quiz.title}</p><p className="text-xs text-muted-foreground">{quiz.published ? 'Published' : 'Draft'} · {quiz.questions.length} questions</p></button>) : <p className="text-sm text-muted-foreground">Generated quizzes will appear here.</p>}</CardContent></Card></div>
      <div className="lg:col-span-2 space-y-6"><Card id="syllabus" className="border-none shadow-sm"><CardHeader><CardTitle className="text-lg">Syllabus / Topics</CardTitle><CardDescription>Paste your syllabus or import a text, PDF, DOCX, or PPTX file.</CardDescription></CardHeader><CardContent className="space-y-4"><input ref={syllabusFileRef} type="file" accept=".txt,.md,.pdf,.docx,.pptx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="hidden" onChange={handleSyllabusFile} /><Button type="button" variant="outline" className="w-full border-dashed" onClick={() => syllabusFileRef.current?.click()}><FileUp className="w-4 h-4 mr-2" />Import syllabus document</Button><Textarea placeholder="Enter syllabus details here..." className="min-h-[200px] bg-background/50 border-dashed border-2" value={syllabus} onChange={(event) => setSyllabus(event.target.value)} /><Button className="w-full h-12 text-lg font-headline" disabled={loading || !syllabus.trim()} onClick={handleGenerate}>{loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-5 h-5 mr-2" />Generate Quiz</>}</Button></CardContent></Card>
      {generatedQuiz && <Card className="border-none shadow-md print:shadow-none"><CardHeader className="bg-primary/5 rounded-t-xl"><div className="flex flex-col sm:flex-row justify-between items-start gap-3"><div><CardTitle className="font-headline text-2xl">{generatedQuiz.title}</CardTitle>{generatedQuiz.description && <CardDescription>{generatedQuiz.description}</CardDescription>}</div><div className="flex gap-2 print:hidden"><Button size="sm" variant="outline" onClick={exportPdf}><Download className="w-4 h-4 mr-1" />Export PDF</Button><Button size="sm" variant={published ? 'secondary' : 'default'} onClick={updatePublication}>{published ? <><Globe2 className="w-4 h-4 mr-1" />Unpublish</> : <><Save className="w-4 h-4 mr-1" />Publish</>}</Button></div></div></CardHeader><CardContent className="space-y-8 pt-6">{generatedQuiz.questions.map((question, index) => <div key={`${question.questionText}-${index}`} className="space-y-3 pb-6 border-b last:border-0"><div className="flex items-start gap-3"><span className="font-bold text-primary bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center shrink-0">{index + 1}</span><p className="font-medium text-lg leading-snug">{question.questionText}</p></div>{question.options ? <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-11">{question.options.map((option) => <div key={option} className={cn('p-3 rounded-lg border text-sm', option === question.correctAnswer ? 'bg-green-50 border-green-200 text-green-700 font-medium' : 'bg-background')}>{option}</div>)}</div> : <div className="pl-11 p-4 bg-muted/30 rounded-lg text-sm italic"><span className="font-bold text-xs uppercase block mb-1">Answer Key</span>{question.correctAnswer}</div>}{question.explanation && <div className="pl-11 mt-2 flex items-start gap-2 text-xs text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-primary" /><span>{question.explanation}</span></div>}</div>)}</CardContent></Card>}
      </div>
    </div>
  </div>;
}
