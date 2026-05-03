"use client"

import { useState } from 'react';
import { generateTeacherQuiz, type GenerateTeacherQuizOutput } from '@/ai/flows/teacher-quiz-generation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Plus, X, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TeacherQuizGenerator() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [syllabus, setSyllabus] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [generatedQuiz, setGeneratedQuiz] = useState<GenerateTeacherQuizOutput | null>(null);

  const handleAddTag = () => {
    if (tagInput && !includeTags.includes(tagInput)) {
      setIncludeTags([...includeTags, tagInput]);
      setTagInput('');
    }
  };

  const handleGenerate = async () => {
    if (!syllabus) {
      toast({ title: "Input Required", description: "Please enter a syllabus or list of topics." });
      return;
    }

    setLoading(true);
    try {
      const result = await generateTeacherQuiz({
        syllabusOrTopics: syllabus,
        difficulty,
        numQuestions,
        questionTypes: ['MCQ', 'conceptual', 'short-answer'],
        includeKeywords: includeTags,
      });
      setGeneratedQuiz(result);
      toast({ title: "Success!", description: "Your quiz has been generated." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate quiz. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">AI Quiz Generator</h1>
        <p className="text-muted-foreground">Create high-quality assessments aligned with your curriculum.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Questions Count</Label>
                <Input 
                  type="number" 
                  min={1} 
                  max={20} 
                  value={numQuestions} 
                  onChange={(e) => setNumQuestions(parseInt(e.target.value))} 
                />
              </div>

              <div className="space-y-2">
                <Label>Focus Keywords</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g. DNA" 
                    value={tagInput} 
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <Button variant="secondary" size="icon" onClick={handleAddTag}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {includeTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="pl-2 pr-1 gap-1">
                      {tag}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => setIncludeTags(includeTags.filter(t => t !== tag))} />
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Syllabus / Topics</CardTitle>
              <CardDescription>Paste your syllabus content or list the topics to cover.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Enter syllabus details here..." 
                className="min-h-[200px] bg-background/50 border-dashed border-2"
                value={syllabus}
                onChange={(e) => setSyllabus(e.target.value)}
              />
              <Button 
                className="w-full h-12 text-lg font-headline" 
                disabled={loading}
                onClick={handleGenerate}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2" /> Generate Quiz</>
                )}
              </Button>
            </CardContent>
          </Card>

          {generatedQuiz && (
            <Card className="border-none shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="bg-primary/5 rounded-t-xl">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="font-headline text-2xl">{generatedQuiz.title}</CardTitle>
                    {generatedQuiz.description && <CardDescription>{generatedQuiz.description}</CardDescription>}
                  </div>
                  <Button size="sm" variant="outline" className="bg-white">Export PDF</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                {generatedQuiz.questions.map((q, idx) => (
                  <div key={idx} className="space-y-3 pb-6 border-b last:border-0">
                    <div className="flex items-start gap-3">
                      <span className="font-bold text-primary bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <p className="font-medium text-lg leading-snug">{q.questionText}</p>
                    </div>
                    
                    {q.options && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-11">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className={cn(
                            "p-3 rounded-lg border text-sm transition-colors",
                            opt === q.correctAnswer ? "bg-green-50 border-green-200 text-green-700 font-medium" : "bg-background"
                          )}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {!q.options && (
                      <div className="pl-11 space-y-2">
                        <div className="p-4 bg-muted/30 rounded-lg text-sm italic">
                          <span className="font-bold text-xs uppercase block mb-1">Answer Key</span>
                          {q.correctAnswer}
                        </div>
                      </div>
                    )}

                    {q.explanation && (
                      <div className="pl-11 mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-primary" />
                        <span>{q.explanation}</span>
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

import { cn } from '@/lib/utils';
