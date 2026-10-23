'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { StudyPlanSetup } from '@/lib/study-store';

interface StudyPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: StudyPlanSetup | null;
  topicSuggestions: string[];
  generating: boolean;
  onGenerate: (setup: StudyPlanSetup) => void;
}

interface SubjectRow {
  name: string;
  examDate: string;
  topicsText: string;
}

function toRows(setup: StudyPlanSetup | null): SubjectRow[] {
  if (!setup?.subjects.length) return [{ name: '', examDate: '', topicsText: '' }];
  return setup.subjects.map((subject) => ({
    name: subject.name,
    examDate: subject.examDate,
    topicsText: subject.topics.join(', '),
  }));
}

export function StudyPlanDialog({ open, onOpenChange, initial, topicSuggestions, generating, onGenerate }: StudyPlanDialogProps) {
  const [rows, setRows] = useState<SubjectRow[]>(() => toRows(initial));
  const [hoursPerDay, setHoursPerDay] = useState(initial?.hoursPerDay ?? 2);
  const [dayStartTime, setDayStartTime] = useState(initial?.dayStartTime ?? '15:00');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setRows(toRows(initial));
      setHoursPerDay(initial?.hoursPerDay ?? 2);
      setDayStartTime(initial?.dayStartTime ?? '15:00');
      setError('');
    }
  }, [open, initial]);

  const updateRow = (index: number, patch: Partial<SubjectRow>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addSuggestion = (index: number, topic: string) => {
    const row = rows[index];
    const existing = row.topicsText.split(',').map((item) => item.trim()).filter(Boolean);
    if (existing.some((item) => item.toLowerCase() === topic.toLowerCase())) return;
    updateRow(index, { topicsText: [...existing, topic].join(', ') });
  };

  const submit = () => {
    const subjects = rows
      .map((row) => ({
        name: row.name.trim(),
        examDate: row.examDate,
        topics: row.topicsText.split(',').map((item) => item.trim()).filter(Boolean),
      }))
      .filter((subject) => subject.name);
    if (!subjects.length) {
      setError('Add at least one subject.');
      return;
    }
    if (subjects.some((subject) => !subject.examDate)) {
      setError('Every subject needs its exam date — the plan is built backwards from it.');
      return;
    }
    onGenerate({ subjects, hoursPerDay, dayStartTime });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline text-xl">
            <Sparkles className="size-5 text-primary" /> Build my study plan
          </DialogTitle>
          <DialogDescription>
            The plan works backwards from each exam date — learn first, practice in the middle, revision at the end. Your weak topics from Weak Areas are prioritized automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {rows.map((row, index) => (
            <div key={index} className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">Subject {index + 1}</p>
                {rows.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="size-8 rounded-xl" aria-label="Remove subject" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Subject name</Label>
                  <Input className="h-11 rounded-2xl" placeholder="e.g. Physics" value={row.name} onChange={(event) => updateRow(index, { name: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Exam date</Label>
                  <Input type="date" className="h-11 rounded-2xl" value={row.examDate} onChange={(event) => updateRow(index, { examDate: event.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Topics (optional, comma separated)</Label>
                <Input className="h-11 rounded-2xl" placeholder="e.g. Thermodynamics, Optics, Waves" value={row.topicsText} onChange={(event) => updateRow(index, { topicsText: event.target.value })} />
                {topicSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {topicSuggestions.slice(0, 8).map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => addSuggestion(index, topic)}
                        className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        + {topic}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" className="w-full rounded-2xl border-dashed" onClick={() => setRows((current) => [...current, { name: '', examDate: '', topicsText: '' }])}>
            <Plus className="mr-1.5 size-4" /> Add another subject
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hours per day</Label>
              <Input type="number" min={0.5} max={8} step={0.5} className="h-11 rounded-2xl" value={hoursPerDay} onChange={(event) => setHoursPerDay(Number(event.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Start studying at</Label>
              <Input type="time" className="h-11 rounded-2xl" value={dayStartTime} onChange={(event) => setDayStartTime(event.target.value)} />
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}

          <Button className="h-12 w-full rounded-2xl text-base font-semibold" disabled={generating} onClick={submit}>
            {generating ? <><Loader2 className="mr-2 size-5 animate-spin" /> Building your plan...</> : <><Sparkles className="mr-2 size-5" /> Generate plan</>}
          </Button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Sessions are added as normal tasks — your manual tasks are never touched, and rebalancing only replaces future planned sessions.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
