'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudentQuizGenerationOutput } from '@/ai/flows/student-quiz-generation-flow';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, BookOpen, Clock, AlertCircle, CheckCircle2, XCircle, ChevronRight, Lightbulb, Target, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getAttempts, getQuizzes, makeId, saveAttempt, saveQuiz, takeStudySeed, type QuizAttempt, type StoredQuiz } from '@/lib/study-store';
import { useFirebase } from '@/firebase';
import { loadAttempts, loadPublishedQuizzes, saveAttemptStatToFirestore, saveAttemptToFirestore, saveQuizToFirestore } from '@/lib/firestore-store';
import { parseApiResponse } from '@/lib/api-response';
import { SourcePicker, type SourceSelection } from '@/components/SourcePicker';
import { buildFeedbackSummary, resolveAdaptiveDifficulty, type DifficultyLevel, type FeedbackSummary } from '@/lib/analytics';

const TEXT_PLACEHOLDER_URI = 'data:application/pdf;base64,AA==';

function ExplainSimplyButton({ question, correctAnswer, explanation }: { question: string; correctAnswer: string; explanation: string }) {
  const [simple, setSimple] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/student/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, correctAnswer, explanation }),
      });
      const payload = await parseApiResponse<{ simple: string }>(response);
      setSimple(payload.simple);
    } catch {
      setSimple('Could not simplify this right now — please try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  if (simple) {
    return (
      <div className="mt-3 rounded-xl bg-white/70 p-3.5 text-sm leading-relaxed text-foreground">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"><Lightbulb className="size-3.5" /> In simple words</p>
        {simple}
      </div>
    );
  }
  return (
    <Button variant="outline" size="sm" className="mt-3 rounded-xl bg-white/60" disabled={busy} onClick={() => void run()}>
      {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Lightbulb className="mr-1.5 size-3.5" />}
      Explain simply
    </Button>
  );
}

export default function StudentQuizCenter() {
  const { toast } = useToast();
  const { firestore, user, isUserLoading } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [difficultyChoice, setDifficultyChoice] = useState<'Adaptive' | DifficultyLevel>('Adaptive');
  const [numQuestions, setNumQuestions] = useState(5);
  const [quiz, setQuiz] = useState<StudentQuizGenerationOutput | null>(null);
  const [quizId, setQuizId] = useState('');
  const [publishedQuizzes, setPublishedQuizzes] = useState<StoredQuiz[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  const [selection, setSelection] = useState<SourceSelection | null>(null);
  const [seedMaterial, setSeedMaterial] = useState<{ label: string; text: string; topic?: string } | null>(null);
  const [pickerSeed, setPickerSeed] = useState<{ sourceId: string; topicTitle?: string } | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activePublished, setActivePublished] = useState<StoredQuiz | null>(null);
  const [lastSummary, setLastSummary] = useState<FeedbackSummary | null>(null);
  const seedConsumed = useRef(false);

  useEffect(() => {
    const refresh = () => {
      setPublishedQuizzes(getQuizzes().filter((item) => item.source === 'teacher' && item.published));
      setAttempts(getAttempts());
    };
    refresh();
    window.addEventListener('scholarmate:changed', refresh);
    return () => window.removeEventListener('scholarmate:changed', refresh);
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) return;
    loadPublishedQuizzes(firestore, user).then((remoteQuizzes) => {
      if (remoteQuizzes.length) setPublishedQuizzes(remoteQuizzes);
    }).catch(() => undefined);
    loadAttempts(firestore, user).then((remoteAttempts) => {
      if (remoteAttempts.length) setAttempts(remoteAttempts);
    }).catch(() => undefined);
  }, [firestore, isUserLoading, user]);

  // One-shot handoffs (quiz from notes, practice from Weak Areas).
  useEffect(() => {
    if (seedConsumed.current) return;
    seedConsumed.current = true;
    const seed = takeStudySeed('quiz');
    if (!seed) return;
    if (seed.sourceId) {
      setPickerSeed({ sourceId: seed.sourceId, topicTitle: seed.topicTitle });
      toast({ title: 'Material selected for you', description: seed.label });
    } else if (seed.text) {
      setSeedMaterial({ label: seed.label, text: seed.text, topic: seed.topic });
      toast({ title: 'Material ready', description: seed.label });
    }
  }, [toast]);

  const handleSelectionChange = useCallback((next: SourceSelection | null) => {
    setSelection(next);
  }, []);

  const realTopics = (selection?.topicTitles || []).filter((title) => !title.startsWith('Pages '));
  const primaryTopic = seedMaterial?.topic || (realTopics.length === 1 ? realTopics[0] : null);
  const adaptive = resolveAdaptiveDifficulty(attempts, primaryTopic);
  const resolvedDifficulty: DifficultyLevel = difficultyChoice === 'Adaptive' ? adaptive.level : difficultyChoice;

  const startPublishedQuiz = (publishedQuiz: StoredQuiz) => {
    setQuizId(publishedQuiz.id);
    setActivePublished(publishedQuiz);
    setActiveTopic(publishedQuiz.topic || publishedQuiz.title);
    setLastSummary(null);
    setQuiz({ quizTitle: publishedQuiz.title, questions: publishedQuiz.questions as StudentQuizGenerationOutput['questions'] });
    setActiveQuestion(0);
    setUserAnswers({});
    setCheckedAnswers({});
    setScore(0);
    setIsSubmitted(false);
  };

  const handleGenerate = async () => {
    const hasTextMaterial = Boolean(seedMaterial?.text || selection?.chunks.length);
    const hasMedia = !seedMaterial && Boolean(selection?.media);
    if (!hasTextMaterial && !hasMedia) {
      toast({ title: 'Document Required', description: 'Please add study material and keep at least one topic selected.' });
      return;
    }

    setLoading(true);
    setQuiz(null);
    setLastSummary(null);
    setActivePublished(null);
    setIsSubmitted(false);
    setActiveQuestion(0);
    setUserAnswers({});
    setCheckedAnswers({});
    setScore(0);

    try {
      let body: Record<string, unknown>;
      if (seedMaterial?.text) {
        body = {
          studyMaterialDataUri: TEXT_PLACEHOLDER_URI,
          fileName: 'notes.txt',
          difficulty: resolvedDifficulty,
          numberOfQuestions: numQuestions,
          questionTypes: ['MCQ', 'Short Answer', 'Conceptual/Scenario-based'],
          studyMaterialText: seedMaterial.text.slice(0, 48000),
          focusTopics: seedMaterial.topic ? [seedMaterial.topic] : undefined,
        };
      } else if (selection?.chunks.length) {
        body = {
          studyMaterialDataUri: TEXT_PLACEHOLDER_URI,
          fileName: selection.sourceNames[0] || 'material.pdf',
          difficulty: resolvedDifficulty,
          numberOfQuestions: numQuestions,
          questionTypes: ['MCQ', 'Short Answer', 'Conceptual/Scenario-based'],
          studyMaterialText: selection.selectedText,
          focusTopics: realTopics.length ? realTopics : undefined,
        };
      } else if (selection?.media) {
        const media = selection.media;
        const preparedPdf = media.geminiFileUri || (media.pdfText || media.pdfPageImages.length ? TEXT_PLACEHOLDER_URI : media.fileData);
        body = {
          studyMaterialDataUri: preparedPdf,
          fileName: media.fileName,
          mimeType: media.fileName?.endsWith('.docx')
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : media.fileName?.endsWith('.pptx')
              ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
              : undefined,
          difficulty: resolvedDifficulty,
          numberOfQuestions: numQuestions,
          questionTypes: ['MCQ', 'Short Answer', 'Conceptual/Scenario-based'],
          studyMaterialText: media.pdfText || undefined,
          pdfPageImages: media.pdfText.length <= 40 ? media.pdfPageImages : undefined,
        };
      } else {
        throw new Error('No material selected.');
      }

      const response = await fetch('/api/student/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await parseApiResponse<StudentQuizGenerationOutput>(response);
      const generatedId = makeId('student-quiz');
      const topic = primaryTopic || result.quizTitle;
      setQuizId(generatedId);
      setActiveTopic(topic);
      setQuiz(result);
      const savedQuiz = { id: generatedId, title: result.quizTitle, questions: result.questions, source: 'student' as const, creator: 'student', published: false, createdAt: new Date().toISOString(), topic };
      saveQuiz(savedQuiz);
      void saveQuizToFirestore(firestore, user, savedQuiz).catch(() => undefined);
      toast({ title: 'Quiz Ready!', description: difficultyChoice === 'Adaptive' ? `Adaptive level: ${resolvedDifficulty}. ${adaptive.reason}` : 'Your quiz has been generated from the selected material.' });
    } catch (error) {
      toast({ title: 'Generation failed', description: error instanceof Error ? error.message : 'The document could not be analyzed.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Quiz taking state
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<number, boolean>>({}); // Tracks if a question has been "Checked" for feedback
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

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
      setScore((prev) => prev + 1);
    }

    setCheckedAnswers({ ...checkedAnswers, [activeQuestion]: true });
  };

  const nextQuestion = () => {
    if (!quiz) return;
    if (activeQuestion < quiz.questions.length - 1) {
      setActiveQuestion((prev) => prev + 1);
      return;
    }
    const perQuestion = quiz.questions.map((question, index) =>
      checkedAnswers[index]
        ? (userAnswers[index] || '').trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
        : false
    );
    const topic = activeTopic || quiz.quizTitle;
    const attempt: QuizAttempt = {
      id: makeId('attempt'),
      quizId: quizId || quiz.quizTitle || 'student-quiz',
      quizTitle: quiz.quizTitle || 'Student quiz',
      score,
      total: quiz.questions.length,
      completedAt: new Date().toISOString(),
      topic,
      perQuestion,
    };
    saveAttempt(attempt);
    void saveAttemptToFirestore(firestore, user, attempt).catch(() => undefined);
    if (activePublished) {
      void saveAttemptStatToFirestore(firestore, user, activePublished.id, {
        id: attempt.id,
        topic,
        score: attempt.score,
        total: attempt.total,
        completedAt: attempt.completedAt,
      }).catch(() => undefined);
    }
    setLastSummary(buildFeedbackSummary(score, quiz.questions.length, perQuestion, quiz.questions, topic));
    setIsSubmitted(true);
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 sm:space-y-8">
      <div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
          <Sparkles className="size-3" /> AI Quiz
        </p>
        <h1 className="mt-2.5 font-headline text-3xl font-bold tracking-tight sm:text-4xl">Interactive AI Quiz</h1>
        <p className="mt-1.5 text-muted-foreground">Test your knowledge with real-time feedback that adapts to your progress.</p>
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
                {seedMaterial ? (
                  <div className="flex items-start justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Material ready for your quiz</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{seedMaterial.label}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-xl" aria-label="Clear material" onClick={() => setSeedMaterial(null)}>
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

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select value={difficultyChoice} onValueChange={(v: 'Adaptive' | DifficultyLevel) => setDifficultyChoice(v)}>
                      <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Adaptive">Adaptive (recommended)</SelectItem>
                        <SelectItem value="Easy">Easy</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    {difficultyChoice === 'Adaptive' && (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Adaptive level: <span className="font-semibold text-primary">{adaptive.level}</span> — {adaptive.reason}
                      </p>
                    )}
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

                <Button className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/25" disabled={loading || (!seedMaterial && !selection?.hasMaterial)} onClick={() => void handleGenerate()}>
                  {loading ? <><Loader2 className="mr-2 size-5 animate-spin" /> Decoding Material...</> : <><Sparkles className="mr-2 size-5" /> Generate Interactive Quiz</>}
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
        <div className="space-y-5">
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
              <Button className="h-12 w-full rounded-2xl font-semibold" onClick={() => { setQuiz(null); setQuizId(''); setActivePublished(null); setActiveTopic(null); setLastSummary(null); setUserAnswers({}); setCheckedAnswers({}); setScore(0); setIsSubmitted(false); }}>Start New Session</Button>
              <Button variant="outline" className="h-12 w-full rounded-2xl font-semibold" asChild><a href="/student">Dashboard</a></Button>
            </div>
          </Card>

          {lastSummary && (
            <Card className="animate-in fade-in border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent"><Target className="size-4" /></span>
                  Your personal feedback
                </CardTitle>
                <CardDescription>{lastSummary.headline} You scored {lastSummary.pct}% on this quiz.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {lastSummary.missed.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">What to revise — your missed questions:</p>
                    {lastSummary.missed.map((missed) => (
                      <div key={missed.index} className="rounded-2xl border border-border/60 bg-white/60 p-4">
                        <p className="text-sm font-medium leading-relaxed">Q{missed.index + 1}. {missed.questionText}</p>
                        <p className="mt-1.5 text-sm text-muted-foreground">Correct answer: <span className="font-medium text-foreground">{missed.correctAnswer}</span></p>
                        {missed.explanation && (
                          <>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{missed.explanation}</p>
                            <ExplainSimplyButton question={missed.questionText} correctAnswer={missed.correctAnswer} explanation={missed.explanation} />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700">Perfect round — nothing missed. Push the level up next time.</p>
                )}
                <div className="flex flex-col gap-2.5 rounded-2xl bg-primary/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-relaxed"><span className="font-semibold text-primary">Next step:</span> {lastSummary.nextStep}</p>
                  <Button className="shrink-0 rounded-xl" asChild><a href="/student/weak-areas">Open Weak Areas</a></Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
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
                      let variantClasses = 'border-border hover:border-primary/30 hover:bg-muted/40';
                      if (isChecked) {
                        if (isCorrect) variantClasses = 'border-emerald-500 bg-emerald-50 text-emerald-700';
                        else if (isSelected) variantClasses = 'border-red-500 bg-red-50 text-red-700';
                      } else if (isSelected) {
                        variantClasses = 'border-primary bg-primary/5 shadow-sm';
                      }
                      return (
                        <div key={i} className={cn('flex items-center space-x-2 rounded-2xl border-2 p-3.5 transition-all sm:p-4', !isChecked && 'cursor-pointer', variantClasses)}>
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
                      className={cn('min-h-[140px] w-full rounded-2xl border-2 bg-background p-4 text-[15px] outline-none transition-all sm:min-h-[150px]', isChecked ? 'border-border bg-muted/40' : 'border-border focus:border-primary')}
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
                      <ExplainSimplyButton question={currentQuestion.questionText} correctAnswer={currentQuestion.correctAnswer} explanation={currentQuestion.explanation} />
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
                    {activeQuestion < quiz.questions.length - 1 ? 'Next Question' : 'Finish Review'}
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
