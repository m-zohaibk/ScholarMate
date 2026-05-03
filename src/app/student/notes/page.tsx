"use client"

import { useState } from 'react';
import { generateStructuredNotes, type StudentStructuredNotesOutput } from '@/ai/flows/student-structured-notes';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, Sparkles, Loader2, Download, Copy, ListTree, Highlighter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function StudentNotesGenerator() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [detailLevel, setDetailLevel] = useState<'summary' | 'detailed'>('detailed');
  const [notes, setNotes] = useState<StudentStructuredNotesOutput | null>(null);

  const handleGenerate = async () => {
    if (!input) {
      toast({ title: "Input Required", description: "Please enter study material or paste your content." });
      return;
    }

    setLoading(true);
    try {
      const result = await generateStructuredNotes({
        studyMaterial: input,
        detailLevel,
      });
      setNotes(result);
      toast({ title: "Success!", description: "Structured notes have been generated." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate notes. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">AI Structured Notes</h1>
        <p className="text-muted-foreground">Transform complex materials into clear, organized study notes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Input Material
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Study Material</Label>
                <Textarea 
                  placeholder="Paste textbook excerpts, lecture transcript, or your own prompts here..." 
                  className="min-h-[300px] resize-none bg-background/50"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Detail Level</Label>
                <Tabs value={detailLevel} onValueChange={(v: any) => setDetailLevel(v)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="detailed">Detailed</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Button 
                className="w-full h-12 text-lg font-headline bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20" 
                disabled={loading}
                onClick={handleGenerate}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing...</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2" /> Generate Notes</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          {!notes ? (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 bg-white/40 rounded-3xl border border-dashed">
              <div className="bg-muted p-6 rounded-full mb-4">
                <ListTree className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="font-headline text-xl font-bold text-muted-foreground">No Notes Yet</h3>
              <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                Upload or paste your material on the left to generate structured notes.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-headline text-2xl font-bold text-primary">{notes.title}</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" className="rounded-full shadow-sm"><Copy className="w-4 h-4" /></Button>
                  <Button variant="outline" size="icon" className="rounded-full shadow-sm"><Download className="w-4 h-4" /></Button>
                </div>
              </div>

              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5 py-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Highlighter className="w-4 h-4" />
                    <span className="font-bold text-xs uppercase tracking-wider">Executive Summary</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 text-muted-foreground leading-relaxed text-sm">
                  {notes.summary}
                </CardContent>
              </Card>

              {notes.sections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-4">
                  <h3 className="font-headline text-xl font-bold border-b pb-2 text-foreground">{section.heading}</h3>
                  <div className="grid gap-4">
                    {section.subsections.map((sub, subIdx) => (
                      <Card key={subIdx} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardHeader className="py-4">
                          <CardTitle className="text-base font-semibold text-accent">{sub.subheading}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ul className="space-y-3">
                            {sub.points.map((point, pIdx) => (
                              <li key={pIdx} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                <span>{point}</span>
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
