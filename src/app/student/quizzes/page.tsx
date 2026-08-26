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
      toast({ title: 'PDF is still preparing', description: 'Wait for the PDF to finish uploading to Gemini Files API.' });
      return;
    }
    if (fileName?.toLowerCase().endsWith('.pdf') && !geminiFileUri && !pdfText && !pdfPageImages.length) {
      toast({ title: 'PDF is not ready', description: 'The PDF must finish uploading to Gemini before a Quiz can be generated.' });
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

  return <>
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Interactive AI Quiz</h1>
        <p className="text-muted-foreground">Transcribe handwritten notes and test your knowledge with real-time feedback.</p>
      </div>

      {!quiz ? (
        <div className="space-y-6">
        <Card className="border-none shadow-sm overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/3 bg-primary/5 p-8 flex flex-col items-center justify-center text-center border-r border-dashed">
              <div className="bg-primary/10 p-4 rounded-3xl mb-4">
                <BookOpen className="w-10 h-10 text-primary" />
              </div>
              <h3 className="font-headline text-xl font-bold">Smart Analysis</h3>
              <p className="text-sm text-muted-foreground mt-2">Supports PDFs, printed text, handwriting OCR, DOCX, and PPTX files.</p>
            </div>
            <div className="md:w-2/3 p-8 space-y-6 bg-white">
              <div className="space-y-2">
                <Label>Source Document (PDF, Image, DOCX, or PPTX)</Label>
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept="application/pdf,image/*,.docx,.pptx"
                />
                <Button 
                  variant="outline" 
                  className="w-full h-12 border-dashed border-2 rounded-xl"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {fileName || "Upload PDF, images, DOCX, or PPTX with no application size limit"}
                </Button>
                <p className="text-xs text-muted-foreground">{geminiFileUri ? 'PDF uploaded securely to Gemini Files API; native document understanding will be used.' : pdfTotalPages ? `Scanned PDF: ${pdfRenderedPages} of ${pdfTotalPages} page${pdfTotalPages === 1 ? '' : 's'} prepared for OCR${pdfTruncated ? ' due to request limits' : ''}.` : 'Scanned PDFs use Gemini Files API when possible, with browser OCR fallback.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
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
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Questions</SelectItem>
                      <SelectItem value="5">5 Questions</SelectItem>
                      <SelectItem value="10">10 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                className="w-full h-12 text-lg font-headline bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" 
                disabled={loading || pdfIngestionLoading || !fileData}
                onClick={() => void handleGenerate()}
              >
                {pdfIngestionLoading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Preparing PDF...</>
                ) : loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Decoding Material...</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2" /> Generate Interactive Quiz</>
                )}
              </Button>
            </div>
          </div>
        </Card>
        {publishedQuizzes.length > 0 && <Card className="border-none shadow-sm"><CardHeader><CardTitle className="text-lg">Published by your teacher</CardTitle><CardDescription>Start a shared assessment from your course.</CardDescription></CardHeader><CardContent className="space-y-2">{publishedQuizzes.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.questions.length} questions</p></div><Button size="sm" onClick={() => startPublishedQuiz(item)}>Start</Button></div>)}</CardContent></Card>}
        </div>
      ) : isSubmitted ? (
        <Card className="border-none shadow-xl text-center p-12 space-y-8 animate-in zoom-in-95 duration-500">
          <div className="space-y-2">
            <h2 className="font-headline text-4xl font-bold">Session Review</h2>
            <p className="text-muted-foreground text-lg">{quiz.quizTitle}</p>
          </div>
          
          <div className="flex justify-center">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-muted" />
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={552} strokeDashoffset={552 - (552 * score / quiz.questions.length)} className="text-primary transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold">{score}</span>
                <span className="text-muted-foreground text-sm">out of {quiz.questions.length}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 max-w-sm mx-auto">
            <Button className="w-full h-12 font-headline" onClick={() => { setQuiz(null); setQuizId(''); setFileData(null); setFileName(null); setUserAnswers({}); setCheckedAnswers({}); setScore(0); setIsSubmitted(false); }}>Start New Session</Button>
            <Button variant="outline" className="w-full h-12 font-headline" asChild><a href="/student">Dashboard</a></Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-primary font-bold text-sm tracking-wider uppercase mb-1">{quiz.quizTitle}</p>
              <h2 className="text-xl font-headline font-bold">Question {activeQuestion + 1} of {quiz.questions.length}</h2>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground bg-white px-3 py-1 rounded-full border shadow-sm">
              <span className="text-xs font-medium">Vision AI Powered</span>
            </div>
          </div>

          <Progress value={progress} className="h-2" />

          <Card className="border-none shadow-lg overflow-hidden">
            <CardContent className="p-8 space-y-8">
              <div className="space-y-6">
                <p className="text-2xl font-medium leading-tight">{currentQuestion?.questionText}</p>
                
                {currentQuestion?.type === 'MCQ' && currentQuestion.options && (
                  <RadioGroup 
                    value={userAnswers[activeQuestion]} 
                    onValueChange={handleAnswerSelect}
                    className="grid gap-3 pt-4"
                  >
                    {currentQuestion.options.map((opt, i) => {
                      const isSelected = userAnswers[activeQuestion] === opt;
                      const isCorrect = opt === currentQuestion.correctAnswer;
                      
                      let variantClasses = "border-muted hover:border-primary/20 hover:bg-muted/30";
                      if (isChecked) {
                        if (isCorrect) variantClasses = "border-green-500 bg-green-50 text-green-700";
                        else if (isSelected) variantClasses = "border-red-500 bg-red-50 text-red-700";
                      } else if (isSelected) {
                        variantClasses = "border-primary bg-primary/5";
                      }

                      return (
                        <div key={i} className={cn(
                          "flex items-center space-x-2 border-2 rounded-xl p-4 transition-all",
                          !isChecked && "cursor-pointer",
                          variantClasses
                        )}>
                          <RadioGroupItem value={opt} id={`opt-${i}`} className="hidden" disabled={isChecked} />
                          <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer font-medium flex items-center justify-between">
                            {opt}
                            {isChecked && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                            {isChecked && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-600" />}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                )}

                {currentQuestion?.type !== 'MCQ' && (
                  <div className="pt-4 space-y-4">
                    <textarea 
                      className={cn(
                        "w-full min-h-[150px] p-4 rounded-xl border-2 bg-background outline-none transition-all",
                        isChecked ? "border-muted-foreground/30 bg-muted/10" : "border-muted focus:border-primary"
                      )}
                      placeholder="Type your answer based on the document contents..."
                      value={userAnswers[activeQuestion] || ''}
                      onChange={(e) => handleAnswerSelect(e.target.value)}
                      disabled={isChecked}
                    />
                    
                    {isChecked && (
                      <div className="p-6 bg-primary/5 border rounded-xl animate-in slide-in-from-top-2">
                        <p className="text-sm font-bold text-primary uppercase mb-2">Reference Answer</p>
                        <p className="text-foreground">{currentQuestion?.correctAnswer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isChecked && currentQuestion?.explanation && (
                <div className="bg-muted/50 p-6 rounded-xl border-l-4 border-accent animate-in fade-in duration-500">
                  <div className="flex gap-2 items-start">
                    <AlertCircle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-accent uppercase mb-1">AI Explanation</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{currentQuestion.explanation}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-6 border-t">
                <Button 
                  variant="ghost" 
                  disabled={activeQuestion === 0 || loading}
                  onClick={() => {
                    setActiveQuestion(activeQuestion - 1);
                  }}
                >
                  Previous
                </Button>
                
                {!isChecked ? (
                  <Button 
                    className="px-8 rounded-xl font-headline bg-primary hover:bg-primary/90"
                    disabled={!userAnswers[activeQuestion]}
                    onClick={handleCheckAnswer}
                  >
                    Check Answer
                  </Button>
                ) : (
                  <Button 
                    className="px-8 rounded-xl font-headline bg-accent hover:bg-accent/90"
                    onClick={nextQuestion}
                  >
                    {activeQuestion < quiz.questions.length - 1 ? "Next Question" : "Finish Review"} 
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  </>;
}
