'use client';

import { useEffect, useState, useRef } from 'react';
import type { StudentQuizGenerationOutput } from '@/ai/flows/student-quiz-generation-flow';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, BookOpen, Clock, AlertCircle, CheckCircle2, XCircle, ChevronRight, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getQuizzes, makeId, saveAttempt, saveQuiz, type StoredQuiz } from '@/lib/study-store';
import { useFirebase } from '@/firebase';
import { loadPublishedQuizzes, saveAttemptToFirestore, saveQuizToFirestore } from '@/lib/firestore-store';
import { preparePdfForUpload } from '@/lib/browser-pdf';
import { parseApiResponse } from '@/lib/api-response';
import { uploadPdfForGemini } from '@/lib/gemini-file-client';

export default function StudentQuizCenter() {
  const { toast } = useToast();
  const { firestore, user, isUserLoading } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [pdfIngestionLoading, setPdfIngestionLoading] = useState(false);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [quiz, setQuiz] = useState<StudentQuizGenerationOutput | null>(null);
  const [quizId, setQuizId] = useState('');
  const [publishedQuizzes, setPublishedQuizzes] = useState<StoredQuiz[]>([]);

  useEffect(() => {
    const refresh = () => setPublishedQuizzes(getQuizzes().filter((item) => item.source === 'teacher' && item.published));
    refresh();
    window.addEventListener('scholarmate:changed', refresh);
    return () => window.removeEventListener('scholarmate:changed', refresh);
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) return;
    loadPublishedQuizzes(firestore, user).then((remoteQuizzes) => {
      if (remoteQuizzes.length) setPublishedQuizzes(remoteQuizzes);
    }).catch(() => undefined);
  }, [firestore, isUserLoading, user]);
  
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfText, setPdfText] = useState('');
  const [pdfPageImages, setPdfPageImages] = useState<string[]>([]);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfRenderedPages, setPdfRenderedPages] = useState(0);
  const [pdfTruncated, setPdfTruncated] = useState(false);
  const [geminiFileUri, setGeminiFileUri] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quiz taking state
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<number, boolean>>({}); // Tracks if a question has been "Checked" for feedback
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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

  const startPublishedQuiz = (publishedQuiz: StoredQuiz) => {
    setQuizId(publishedQuiz.id);
    setQuiz({ quizTitle: publishedQuiz.title, questions: publishedQuiz.questions as StudentQuizGenerationOutput['questions'] });
    setActiveQuestion(0);
    setUserAnswers({});
    setCheckedAnswers({});
    setScore(0);
    setIsSubmitted(false);
  };

  const handleGenerate = async () => {
    if (!fileData) {
      toast({ title: "Document Required", description: "Please upload a study material file." });
      return;
    }
    if (pdfIngestionLoading) {
      toast({ title: 'PDF is still preparing', description: 'Wait for the PDF to finish its secure upload.' });
      return;
    }
    if (fileName?.toLowerCase().endsWith('.pdf') && !geminiFileUri && !pdfText && !pdfPageImages.length) {
      toast({ title: 'PDF is not ready', description: 'The PDF must finish uploading before a quiz can be generated.' });
      return;
    }

    setLoading(true);
    setQuiz(null);
    setIsSubmitted(false);
    setActiveQuestion(0);
    setUserAnswers({});
    setCheckedAnswers({});
    setScore(0);
    const preparedPdf = geminiFileUri || (pdfText || pdfPageImages.length ? 'data:application/pdf;base64,AA==' : fileData);

    try {
      const requestBody = JSON.stringify({ studyMaterialDataUri: preparedPdf, fileName, mimeType: fileName?.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : fileName?.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : undefined, difficulty, numberOfQuestions: numQuestions, questionTypes: ['MCQ', 'Short Answer', 'Conceptual/Scenario-based'], studyMaterialText: pdfText || undefined, pdfPageImages: pdfText.length <= 40 ? pdfPageImages : undefined });
      const response = await fetch('/api/student/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody });
      const payload = await parseApiResponse<StudentQuizGenerationOutput>(response);
      const result = payload;
      const generatedId = makeId('student-quiz');
      setQuizId(generatedId);
      setQuiz(result);
      const savedQuiz = { id: generatedId, title: result.quizTitle, questions: result.questions, source: 'student' as const, creator: 'student', published: false, createdAt: new Date().toISOString() };
      saveQuiz(savedQuiz);
      void saveQuizToFirestore(firestore, user, savedQuiz).catch(() => undefined);
      toast({ title: "Quiz Ready!", description: "AI has processed your document, including handwritten notes." });
    } catch (error) {
      toast({ title: 'Generation failed', description: error instanceof Error ? error.message : 'The document could not be analyzed.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = quiz?.questions[activeQuestion];
  const progress = quiz ? ((activeQuestion + 1) / quiz.questions.length) * 100 : 0;
  const isChecked = checkedAnswers[activeQuestion];

  const handleAnswerSelect = (val: string) => {
    if (isChecked) return; // Prevent changing after checking
    setUserAnswers({ ...userAnswers, [activeQuestion]: val });
  };

  const handleCheckAnswer = () => {
    if (!userAnswers[activeQuestion] || !currentQuestion) return;
    
    const isCorrect = userAnswers[activeQuestion].trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    
    setCheckedAnswers({ ...checkedAnswers, [activeQuestion]: true });
  };

  const nextQuestion = () => {
    if (activeQuestion < (quiz?.questions.length || 0) - 1) {
      setActiveQuestion(prev => prev + 1);
    } else {
      const attempt = { id: makeId('attempt'), quizId: quizId || quiz?.quizTitle || 'student-quiz', quizTitle: quiz?.quizTitle || 'Student quiz', score, total: quiz?.questions.length || 0, completedAt: new Date().toISOString() };
      saveAttempt(attempt);
      void saveAttemptToFirestore(firestore, user, attempt).catch(() => undefined);
      setIsSubmitted(true);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 sm:space-y-8">
      <div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
          <Sparkles className="size-3" /> AI Quiz
        </p>
        <h1 className="mt-2.5 font-headline text-3xl font-bold tracking-tight sm:text-4xl">Interactive AI Quiz</h1>
        <p className="mt-1.5 text-muted-foreground">Transcribe handwritten notes and test your knowledge with real-time feedback.</p>
      </div>

      {!quiz ? (
        <div className="space-y-5">
          <Card className="overflow-hidden border-border/60">
            <div className="grid md:grid-cols-3">
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-7 text-center sm:p-8">
                <span className="grid size-16 place-items-center rounded-3xl bg-white text-primary shadow-lg shadow-primary/15"><BookOpen className="size-8" /></span>
                <h3 className="mt-4 font-headline text-xl font-bold">Smart Analysis</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Supports PDFs, printed text, handwriting OCR, DOCX, and PPTX files.</p>
              </div>
              <div className="space-y-5 p-5 sm:p-7 md:col-span-2">
                <div className="space-y-2">
                  <Label>Source Document (PDF, Image, DOCX, or PPTX)</Label>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf,image/*,.docx,.pptx" />
                  <Button variant="outline" className="h-auto min-h-12 w-full rounded-2xl border-2 border-dashed py-3.5" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 size-4 shrink-0" />
                    <span className="min-w-0 truncate">{fileName || "Upload PDF, images, DOCX, or PPTX with no application size limit"}</span>
                  </Button>
                  <p className="text-xs leading-relaxed text-muted-foreground">{geminiFileUri ? 'PDF uploaded securely; full document understanding will be used.' : pdfTotalPages ? `Scanned PDF: ${pdfRenderedPages} of ${pdfTotalPages} page${pdfTotalPages === 1 ? '' : 's'} prepared for OCR${pdfTruncated ? ' due to request limits' : ''}.` : 'Scanned PDFs use secure cloud processing when possible, with on-device OCR fallback.'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                      <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Easy">Easy</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Questions</Label>
                    <Select value={numQuestions.toString()} onValueChange={(v) => setNumQuestions(parseInt(v))}>
                      <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 Questions</SelectItem>
                        <SelectItem value="5">5 Questions</SelectItem>
                        <SelectItem value="10">10 Questions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/25" disabled={loading || pdfIngestionLoading || !fileData} onClick={() => void handleGenerate()}>
                  {pdfIngestionLoading ? <><Loader2 className="mr-2 size-5 animate-spin" /> Preparing PDF...</> : loading ? <><Loader2 className="mr-2 size-5 animate-spin" /> Decoding Material...</> : <><Sparkles className="mr-2 size-5" /> Generate Interactive Quiz</>}
                </Button>
              </div>
            </div>
          </Card>
          {publishedQuizzes.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3"><CardTitle className="text-lg">Published by your teacher</CardTitle><CardDescription>Start a shared assessment from your course.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {publishedQuizzes.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-3.5">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.questions.length} questions</p></div>
                    <Button size="sm" className="shrink-0 rounded-xl" onClick={() => startPublishedQuiz(item)}>Start</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : isSubmitted ? (
        <Card className="animate-in zoom-in-95 border-border/60 p-8 text-center sm:p-12">
          <div className="space-y-2">
            <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">Session Review</h2>
            <p className="text-muted-foreground">{quiz.quizTitle}</p>
          </div>
          <div className="mt-8 flex justify-center">
            <div className="relative flex size-44 items-center justify-center sm:size-48">
              <svg className="size-full -rotate-90" viewBox="0 0 192 192">
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-muted" />
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={552} strokeDashoffset={552 - (552 * score / quiz.questions.length)} strokeLinecap="round" className="text-primary transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-headline text-5xl font-bold">{score}</span>
                <span className="text-sm text-muted-foreground">out of {quiz.questions.length}</span>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-8 max-w-sm space-y-3">
            <Button className="h-12 w-full rounded-2xl font-semibold" onClick={() => { setQuiz(null); setQuizId(''); setFileData(null); setFileName(null); setUserAnswers({}); setCheckedAnswers({}); setScore(0); setIsSubmitted(false); }}>Start New Session</Button>
            <Button variant="outline" className="h-12 w-full rounded-2xl font-semibold" asChild><a href="/student">Dashboard</a></Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 truncate text-xs font-bold uppercase tracking-[0.14em] text-primary">{quiz.quizTitle}</p>
              <h2 className="font-headline text-xl font-bold">Question {activeQuestion + 1} of {quiz.questions.length}</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
              <Sparkles className="size-3.5 text-accent" /> Vision AI Powered
            </span>
          </div>

          <Progress value={progress} className="h-2.5 rounded-full" />

          <Card className="overflow-hidden border-border/60 shadow-xl shadow-primary/5">
            <CardContent className="space-y-7 p-5 sm:p-8">
              <div className="space-y-5">
                <p className="text-xl font-medium leading-snug sm:text-2xl">{currentQuestion?.questionText}</p>

                {currentQuestion?.type === 'MCQ' && currentQuestion.options && (
                  <RadioGroup value={userAnswers[activeQuestion]} onValueChange={handleAnswerSelect} className="grid gap-2.5 pt-2">
                    {currentQuestion.options.map((opt, i) => {
                      const isSelected = userAnswers[activeQuestion] === opt;
                      const isCorrect = opt === currentQuestion.correctAnswer;
                      let variantClasses = "border-border hover:border-primary/30 hover:bg-muted/40";
                      if (isChecked) {
                        if (isCorrect) variantClasses = "border-emerald-500 bg-emerald-50 text-emerald-700";
                        else if (isSelected) variantClasses = "border-red-500 bg-red-50 text-red-700";
                      } else if (isSelected) {
                        variantClasses = "border-primary bg-primary/5 shadow-sm";
                      }
                      return (
                        <div key={i} className={cn("flex items-center space-x-2 rounded-2xl border-2 p-3.5 transition-all sm:p-4", !isChecked && "cursor-pointer", variantClasses)}>
                          <RadioGroupItem value={opt} id={`opt-${i}`} className="hidden" disabled={isChecked} />
                          <Label htmlFor={`opt-${i}`} className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-sm font-medium sm:text-[15px]">
                            <span>{opt}</span>
                            {isChecked && isCorrect && <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />}
                            {isChecked && isSelected && !isCorrect && <XCircle className="size-5 shrink-0 text-red-600" />}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                )}

                {currentQuestion?.type !== 'MCQ' && (
                  <div className="space-y-4 pt-2">
                    <textarea
                      className={cn("min-h-[140px] w-full rounded-2xl border-2 bg-background p-4 text-[15px] outline-none transition-all sm:min-h-[150px]", isChecked ? "border-border bg-muted/40" : "border-border focus:border-primary")}
                      placeholder="Type your answer based on the document contents..."
                      value={userAnswers[activeQuestion] || ''}
                      onChange={(e) => handleAnswerSelect(e.target.value)}
                      disabled={isChecked}
                    />
                    {isChecked && (
                      <div className="animate-in slide-in-from-top-2 rounded-2xl border border-primary/15 bg-primary/5 p-5">
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-primary">Reference Answer</p>
                        <p className="text-foreground">{currentQuestion?.correctAnswer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isChecked && currentQuestion?.explanation && (
                <div className="animate-in fade-in rounded-2xl border-l-4 border-accent bg-muted/50 p-5 duration-500 sm:p-6">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" />
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-accent">AI Explanation</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{currentQuestion.explanation}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-5">
                <Button variant="ghost" className="rounded-2xl" disabled={activeQuestion === 0 || loading} onClick={() => { setActiveQuestion(activeQuestion - 1); }}>
                  Previous
                </Button>
                {!isChecked ? (
                  <Button className="rounded-2xl px-6 font-semibold sm:px-8" disabled={!userAnswers[activeQuestion]} onClick={handleCheckAnswer}>
                    Check Answer
                  </Button>
                ) : (
                  <Button className="rounded-2xl bg-accent px-6 font-semibold hover:bg-accent/90 sm:px-8" onClick={nextQuestion}>
                    {activeQuestion < quiz.questions.length - 1 ? "Next Question" : "Finish Review"}
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
