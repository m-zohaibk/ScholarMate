"use client"

import { useState, useRef } from 'react';
import { generateStudentQuiz, type StudentQuizGenerationOutput } from '@/ai/flows/student-quiz-generation-flow';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, BookOpen, Clock, AlertCircle, CheckCircle2, ChevronRight, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';

export default function StudentQuizCenter() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [quiz, setQuiz] = useState<StudentQuizGenerationOutput | null>(null);
  
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quiz taking state
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileData(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!fileData) {
      toast({ title: "Document Required", description: "Please upload a study material file." });
      return;
    }

    setLoading(true);
    setQuiz(null);
    setIsSubmitted(false);
    setActiveQuestion(0);
    setUserAnswers({});

    try {
      const result = await generateStudentQuiz({
        studyMaterialDataUri: fileData,
        difficulty,
        numberOfQuestions: numQuestions,
        questionTypes: ['MCQ', 'Short Answer', 'Conceptual/Scenario-based'],
      });
      setQuiz(result);
      toast({ title: "Quiz Ready!", description: "AI has analyzed your document and prepared your assessment." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate quiz. Check your connection or file type." });
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = quiz?.questions[activeQuestion];
  const progress = quiz ? ((activeQuestion + 1) / quiz.questions.length) * 100 : 0;

  const handleAnswerSelect = (val: string) => {
    setUserAnswers({ ...userAnswers, [activeQuestion]: val });
  };

  const calculateScore = () => {
    if (!quiz) return 0;
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswer) score++;
    });
    return score;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Quiz Center</h1>
        <p className="text-muted-foreground">Test your knowledge using real-world study documents.</p>
      </div>

      {!quiz ? (
        <Card className="border-none shadow-sm overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/3 bg-primary/5 p-8 flex flex-col items-center justify-center text-center border-r border-dashed">
              <div className="bg-primary/10 p-4 rounded-3xl mb-4">
                <BookOpen className="w-10 h-10 text-primary" />
              </div>
              <h3 className="font-headline text-xl font-bold">New Session</h3>
              <p className="text-sm text-muted-foreground mt-2">Upload a PDF or Image to generate a custom quiz.</p>
            </div>
            <div className="md:w-2/3 p-8 space-y-6 bg-white">
              <div className="space-y-2">
                <Label>Source Document</Label>
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept="application/pdf,image/*"
                />
                <Button 
                  variant="outline" 
                  className="w-full h-12 border-dashed border-2 rounded-xl"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {fileName || "Click to upload study material"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Difficulty</Label>
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
                disabled={loading || !fileData}
                onClick={handleGenerate}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing Document...</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2" /> Start AI Quiz</>
                )}
              </Button>
            </div>
          </div>
        </Card>
      ) : isSubmitted ? (
        <Card className="border-none shadow-xl text-center p-12 space-y-8 animate-in zoom-in-95 duration-500">
          <div className="space-y-2">
            <h2 className="font-headline text-4xl font-bold">Quiz Complete!</h2>
            <p className="text-muted-foreground text-lg">Great effort on {quiz.quizTitle}</p>
          </div>
          
          <div className="flex justify-center">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-muted" />
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={552} strokeDashoffset={552 - (552 * calculateScore() / quiz.questions.length)} className="text-primary transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold">{calculateScore()}</span>
                <span className="text-muted-foreground text-sm">out of {quiz.questions.length}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 max-w-sm mx-auto">
            <Button className="w-full h-12 font-headline" onClick={() => setQuiz(null)}>Try Another Quiz</Button>
            <Button variant="outline" className="w-full h-12 font-headline" asChild><a href="/student">Back to Dashboard</a></Button>
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
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium font-code">Multimodal AI Powered</span>
            </div>
          </div>

          <Progress value={progress} className="h-2" />

          <Card className="border-none shadow-lg">
            <CardContent className="p-8 space-y-8">
              <div className="space-y-4">
                <p className="text-xl font-medium leading-relaxed">{currentQuestion?.questionText}</p>
                
                {currentQuestion?.type === 'MCQ' && currentQuestion.options && (
                  <RadioGroup 
                    value={userAnswers[activeQuestion]} 
                    onValueChange={handleAnswerSelect}
                    className="grid gap-3 pt-4"
                  >
                    {currentQuestion.options.map((opt, i) => (
                      <div key={i} className={`
                        flex items-center space-x-2 border-2 rounded-xl p-4 transition-all cursor-pointer
                        ${userAnswers[activeQuestion] === opt ? "border-primary bg-primary/5 shadow-sm" : "border-muted hover:border-primary/20 hover:bg-muted/30"}
                      `}>
                        <RadioGroupItem value={opt} id={`opt-${i}`} className="text-primary" />
                        <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer font-medium">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {currentQuestion?.type !== 'MCQ' && (
                  <div className="pt-4 space-y-4">
                    <p className="text-sm font-medium text-muted-foreground italic">AI Note: This is a {currentQuestion?.type} question based on your document content.</p>
                    <textarea 
                      className="w-full min-h-[150px] p-4 rounded-xl border-2 border-muted bg-background focus:border-primary outline-none transition-all"
                      placeholder="Type your detailed answer here..."
                      value={userAnswers[activeQuestion] || ''}
                      onChange={(e) => handleAnswerSelect(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-6 border-t">
                <Button 
                  variant="ghost" 
                  disabled={activeQuestion === 0}
                  onClick={() => setActiveQuestion(activeQuestion - 1)}
                >
                  Previous
                </Button>
                
                {activeQuestion < quiz.questions.length - 1 ? (
                  <Button 
                    className="px-8 rounded-xl font-headline"
                    disabled={!userAnswers[activeQuestion]}
                    onClick={() => setActiveQuestion(activeQuestion + 1)}
                  >
                    Next Question <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button 
                    className="px-8 rounded-xl font-headline bg-accent hover:bg-accent/90"
                    disabled={Object.keys(userAnswers).length < quiz.questions.length}
                    onClick={() => setIsSubmitted(true)}
                  >
                    Submit Quiz
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
