'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, CheckCircle2, Circle, Sparkles, Bell, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateKey, formatDateLabel, getTasks, makeId, saveTasks, type StudyTask } from '@/lib/study-store';
import { useFirebase } from '@/firebase';
import { loadTasks, saveTaskToFirestore } from '@/lib/firestore-store';
import { cn } from '@/lib/utils';

function durationMinutes(duration: string) {
  return Number(duration.match(/(\d+(?:\.\d+)?)h/)?.[1] || 0) * 60 + Number(duration.match(/(\d+)m/)?.[1] || 0);
}

export default function StudySchedulePlanner() {
  const { toast } = useToast();
  const { firestore, user, isUserLoading } = useFirebase();
  const [date, setDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', time: '15:00', duration: '1h', category: 'General' });

  useEffect(() => {
    const refresh = () => setTasks(getTasks());
    refresh();
    window.addEventListener('scholarmate:changed', refresh);
    return () => window.removeEventListener('scholarmate:changed', refresh);
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) return;
    loadTasks(firestore, user).then((remoteTasks) => {
      if (remoteTasks.length) {
        setTasks(remoteTasks);
        saveTasks(remoteTasks);
      }
    }).catch(() => undefined);
  }, [firestore, isUserLoading, user]);

  const selectedKey = formatDateKey(date);
  const dayTasks = useMemo(() => tasks.filter((task) => task.date === selectedKey).sort((a, b) => a.time.localeCompare(b.time)), [selectedKey, tasks]);
  const completed = dayTasks.filter((task) => task.completed);
  const focusMinutes = completed.reduce((sum, task) => sum + durationMinutes(task.duration), 0);
  const goalMinutes = Math.max(60, dayTasks.reduce((sum, task) => sum + durationMinutes(task.duration), 0));

  const toggleTask = (id: string) => {
    const next = tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task);
    setTasks(next);
    saveTasks(next);
    const changedTask = next.find((task) => task.id === id);
    if (changedTask) void saveTaskToFirestore(firestore, user, changedTask).catch(() => undefined);
  };

  const addTask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    const next = [...tasks, { id: makeId('task'), date: selectedKey, title: form.title.trim(), time: form.time, duration: form.duration.trim() || '1h', category: form.category.trim() || 'General', completed: false }];
    setTasks(next);
    saveTasks(next);
    const addedTask = next[next.length - 1];
    if (addedTask) void saveTaskToFirestore(firestore, user, addedTask).catch(() => undefined);
    setForm({ title: '', time: '15:00', duration: '1h', category: 'General' });
    setShowForm(false);
    toast({ title: 'Task added', description: `Added to ${formatDateLabel(date)}.` });
  };

  const optimize = () => {
    const sorted = [...tasks].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    setTasks(sorted);
    saveTasks(sorted);
    toast({ title: 'Schedule optimized', description: 'Tasks are now ordered by date and start time.' });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            <Clock className="size-3" /> Planner
          </p>
          <h1 className="mt-2.5 font-headline text-3xl font-bold tracking-tight sm:text-4xl">Study Planner</h1>
          <p className="mt-1.5 text-muted-foreground">Plan, track, and improve your learning sessions.</p>
        </div>
        <Button className="w-full rounded-2xl shadow-lg shadow-accent/25 sm:w-auto" onClick={optimize}>
          <Sparkles className="mr-2 size-4" /> AI Optimize Schedule
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-5 lg:col-span-4">
          <Card className="overflow-hidden border-border/60">
            <CardContent className="p-3 sm:p-4">
              <Calendar mode="single" selected={date} onSelect={(next) => next && setDate(next)} className="mx-auto rounded-2xl" />
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Daily Goals</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Focus Time</span>
                <span className="font-bold">{Math.floor(focusMinutes / 60)}h {focusMinutes % 60}m / {Math.floor(goalMinutes / 60)}h</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${Math.min(100, Math.round((focusMinutes / goalMinutes) * 100))}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-primary/5 p-3.5 text-center">
                  <p className="font-headline text-2xl font-bold text-primary">{completed.length}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Completed</p>
                </div>
                <div className="rounded-2xl bg-accent/5 p-3.5 text-center">
                  <p className="font-headline text-2xl font-bold text-accent">{dayTasks.length - completed.length}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="overflow-hidden border-border/60">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-white/50 pb-4">
              <div className="min-w-0">
                <CardTitle className="truncate font-headline text-lg">Schedule for {formatDateLabel(date)}</CardTitle>
                <CardDescription>Keep each session short, focused, and actionable.</CardDescription>
              </div>
              <Badge variant="outline" className="flex shrink-0 items-center gap-1.5 rounded-full border-primary/25 bg-primary/5 px-3 py-1.5 text-primary">
                <Bell className="size-3" /> Reminders Active
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {dayTasks.length ? dayTasks.map((task) => (
                <div key={task.id} className="group flex items-center gap-3.5 border-b border-border/60 p-4 transition-colors last:border-0 hover:bg-primary/[0.03] sm:gap-4 sm:p-5">
                  <div className="w-14 shrink-0 pt-0.5 text-sm font-bold text-muted-foreground">{task.time}</div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2.5">
                      <h4 className={cn('truncate text-[15px] font-bold sm:text-base', task.completed && 'text-muted-foreground line-through')}>{task.title}</h4>
                      <Badge variant="secondary" className="shrink-0 rounded-full font-medium">{task.category}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <Clock className="size-3" />{task.duration}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
                    onClick={() => toggleTask(task.id)}
                    className={cn('grid size-11 shrink-0 place-items-center rounded-2xl transition-all', task.completed ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary')}
                  >
                    {task.completed ? <CheckCircle2 className="size-6" /> : <Circle className="size-6" />}
                  </button>
                </div>
              )) : (
                <div className="p-10 text-center text-muted-foreground sm:p-12">
                  <span className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-muted"><Calendar className="size-7" /></span>
                  <p className="font-medium text-foreground">No tasks planned for this day.</p>
                  <p className="mt-1 text-sm">Tap the + button below to add your first session.</p>
                </div>
              )}
              {showForm ? (
                <form onSubmit={addTask} className="m-4 space-y-4 rounded-3xl border border-border/60 bg-muted/30 p-4 sm:m-6 sm:p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline font-bold">Add study task</h3>
                    <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={() => setShowForm(false)} aria-label="Close"><X className="size-4" /></Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="task-title">Task title</Label><Input id="task-title" className="h-11 rounded-2xl" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Review biology chapter" autoFocus /></div>
                    <div className="space-y-1.5"><Label htmlFor="task-time">Start time</Label><Input id="task-time" type="time" className="h-11 rounded-2xl" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="task-duration">Duration</Label><Input id="task-duration" className="h-11 rounded-2xl" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 45m" /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="task-category">Category</Label><Input id="task-category" className="h-11 rounded-2xl" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                  </div>
                  <Button type="submit" className="h-11 w-full rounded-2xl font-semibold" disabled={!form.title.trim()}>Save Task</Button>
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Button type="button" variant="outline" className="mb-2.5 h-[52px] w-[52px] rounded-full border-2 border-dashed p-0" onClick={() => setShowForm(true)} aria-label="Add task">
                    <Plus className="size-5" />
                  </Button>
                  <p className="text-sm font-medium">Add task for {formatDateLabel(date)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
