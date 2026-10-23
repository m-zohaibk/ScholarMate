'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, CheckCircle2, Circle, Sparkles, Bell, Plus, X, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateKey, formatDateLabel, getAttempts, getPlanSetup, getSources, getTasks, makeId, savePlanSetup, saveTasks, type QuizAttempt, type StudyPlanSetup, type StudyTask } from '@/lib/study-store';
import { useFirebase } from '@/firebase';
import { deleteTaskFromFirestore, loadAttempts, loadTasks, saveTaskToFirestore } from '@/lib/firestore-store';
import { getTopicStats } from '@/lib/analytics';
import { parseApiResponse } from '@/lib/api-response';
import { StudyPlanDialog } from '@/components/StudyPlanDialog';
import { cn } from '@/lib/utils';

function durationMinutes(duration: string) {
  return Number(duration.match(/(\d+(?:\.\d+)?)h/)?.[1] || 0) * 60 + Number(duration.match(/(\d+)m/)?.[1] || 0);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
}

function titlesMatch(a: string, b: string) {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || (left.length >= 4 && right.includes(left)) || (right.length >= 4 && left.includes(right));
}

interface PlanSession {
  date: string;
  time: string;
  durationMinutes: number;
  title: string;
  subject: string;
  topic?: string;
  type: 'Learn' | 'Practice' | 'Revision';
}

interface PlanResult {
  planTitle: string;
  summary: string;
  sessions: PlanSession[];
}

export default function StudySchedulePlanner() {
  const { toast } = useToast();
  const { firestore, user, isUserLoading } = useFirebase();
  const [date, setDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', time: '15:00', duration: '1h', category: 'General' });
  const [planSetup, setPlanSetupState] = useState<StudyPlanSetup | null>(null);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setTasks(getTasks());
      setAttempts(getAttempts());
    };
    refresh();
    setPlanSetupState(getPlanSetup());
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
    loadAttempts(firestore, user).then((remoteAttempts) => {
      if (remoteAttempts.length) setAttempts(remoteAttempts);
    }).catch(() => undefined);
  }, [firestore, isUserLoading, user]);

  const selectedKey = formatDateKey(date);
  const dayTasks = useMemo(() => tasks.filter((task) => task.date === selectedKey).sort((a, b) => a.time.localeCompare(b.time)), [selectedKey, tasks]);
  const completed = dayTasks.filter((task) => task.completed);
  const focusMinutes = completed.reduce((sum, task) => sum + durationMinutes(task.duration), 0);
  const goalMinutes = Math.max(60, dayTasks.reduce((sum, task) => sum + durationMinutes(task.duration), 0));

  const topicSuggestions = useMemo(() => {
    const fromStats = getTopicStats(attempts)
      .filter((stat) => stat.status !== 'Strong')
      .map((stat) => stat.topic);
    const fromSources = getSources().flatMap((source) => source.topics.map((topic) => topic.title));
    return Array.from(new Map([...fromStats, ...fromSources].map((title) => [title.toLowerCase(), title])).values());
  }, [attempts]);

  const upcomingPlanTasks = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    return tasks.filter((task) => task.planId && task.date >= todayKey);
  }, [tasks]);

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

  const buildPlan = async (setup: StudyPlanSetup, mode: 'build' | 'rebalance') => {
    setGeneratingPlan(true);
    try {
      const todayKey = formatDateKey(new Date());
      const stats = getTopicStats(attempts);
      const subjects = setup.subjects.map((subject) => ({
        name: subject.name,
        examDate: subject.examDate,
        topics: subject.topics.map((title) => {
          const stat = stats.find((item) => titlesMatch(item.topic, title) || titlesMatch(item.topic, subject.name));
          return { title, strengthPct: stat?.avgPct, status: stat?.status };
        }),
      }));
      const busyMinutesByDate: Record<string, number> = {};
      for (const task of tasks) {
        if (!task.planId && !task.completed) {
          busyMinutesByDate[task.date] = (busyMinutesByDate[task.date] || 0) + durationMinutes(task.duration);
        }
      }

      const response = await fetch('/api/student/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: todayKey,
          hoursPerDay: setup.hoursPerDay,
          dayStartTime: setup.dayStartTime,
          subjects,
          busyMinutesByDate,
          note: mode === 'rebalance' ? 'This is a rebalance of an existing plan using the student\'s latest quiz scores. Rebuild the remaining days only.' : undefined,
        }),
      });
      const result = await parseApiResponse<PlanResult>(response);

      // Enforce the plan rules locally as well: valid dates, before the exam,
      // and never beyond the student's daily hours (plus their fixed tasks).
      const planId = makeId('plan');
      const usedByDate = new Map<string, number>();
      const newTasks: StudyTask[] = [];
      const sortedSessions = [...result.sessions].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      for (const session of sortedSessions) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date) || session.date < todayKey) continue;
        const subject = setup.subjects.find((item) => titlesMatch(item.name, session.subject));
        if (subject && session.date > subject.examDate) continue;
        const used = (busyMinutesByDate[session.date] || 0) + (usedByDate.get(session.date) || 0);
        if (used + session.durationMinutes > setup.hoursPerDay * 60 + 15) continue;
        usedByDate.set(session.date, (usedByDate.get(session.date) || 0) + session.durationMinutes);
        newTasks.push({
          id: makeId('task'),
          date: session.date,
          time: session.time,
          title: session.title,
          duration: formatDuration(session.durationMinutes),
          category: session.type,
          completed: false,
          planId,
        });
      }
      if (!newTasks.length) throw new Error('The plan came back empty. Try widening the dates or adding topics.');

      const replaced = tasks.filter((task) => task.planId && task.date >= todayKey);
      const kept = tasks.filter((task) => !(task.planId && task.date >= todayKey));
      const next = [...kept, ...newTasks].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      setTasks(next);
      saveTasks(next);
      for (const task of replaced) void deleteTaskFromFirestore(firestore, user, task.id).catch(() => undefined);
      for (const task of newTasks) void saveTaskToFirestore(firestore, user, task).catch(() => undefined);

      const savedSetup: StudyPlanSetup = { ...setup, planTitle: result.planTitle, planSummary: result.summary, generatedAt: new Date().toISOString() };
      savePlanSetup(savedSetup);
      setPlanSetupState(savedSetup);
      setBannerDismissed(false);
      setShowPlanDialog(false);
      toast({
        title: mode === 'rebalance' ? 'Plan rebalanced' : 'Study plan created',
        description: `${newTasks.length} sessions scheduled. Weak topics were prioritized automatically.`,
      });
    } catch (error) {
      toast({ title: 'Plan failed', description: error instanceof Error ? error.message : 'The study plan could not be generated.', variant: 'destructive' });
    } finally {
      setGeneratingPlan(false);
    }
  };

  const removePlanSessions = () => {
    const todayKey = formatDateKey(new Date());
    const removed = tasks.filter((task) => task.planId && task.date >= todayKey);
    const next = tasks.filter((task) => !(task.planId && task.date >= todayKey));
    setTasks(next);
    saveTasks(next);
    for (const task of removed) void deleteTaskFromFirestore(firestore, user, task.id).catch(() => undefined);
    if (planSetup) {
      const cleared = { ...planSetup, planTitle: undefined, planSummary: undefined, generatedAt: undefined };
      savePlanSetup(cleared);
      setPlanSetupState(cleared);
    }
    toast({ title: 'Plan sessions removed', description: 'Your manual tasks and completed sessions were kept.' });
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
        <div className="flex flex-col gap-2.5 sm:flex-row">
          {planSetup?.planTitle && (
            <Button variant="outline" className="rounded-2xl bg-white/70" disabled={generatingPlan} onClick={() => void buildPlan(planSetup, 'rebalance')}>
              {generatingPlan ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />} Rebalance plan
            </Button>
          )}
          <Button className="rounded-2xl shadow-lg shadow-accent/25" onClick={() => setShowPlanDialog(true)}>
            <Sparkles className="mr-2 size-4" /> Build my study plan
          </Button>
        </div>
      </div>

      {planSetup?.planTitle && !bannerDismissed && (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/[0.07] to-accent/[0.07]">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-headline text-lg font-bold">
                <Sparkles className="size-5 shrink-0 text-primary" /> {planSetup.planTitle}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{planSetup.planSummary}</p>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                {upcomingPlanTasks.length} planned session{upcomingPlanTasks.length === 1 ? '' : 's'} ahead · built {planSetup.generatedAt ? new Date(planSetup.generatedAt).toLocaleDateString() : ''}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" className="rounded-xl bg-white/70" onClick={removePlanSessions}>
                <Trash2 className="mr-1.5 size-3.5" /> Remove sessions
              </Button>
              <Button variant="ghost" size="icon" className="size-9 rounded-xl" aria-label="Dismiss plan summary" onClick={() => setBannerDismissed(true)}>
                <X className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <StudyPlanDialog
        open={showPlanDialog}
        onOpenChange={setShowPlanDialog}
        initial={planSetup}
        topicSuggestions={topicSuggestions}
        generating={generatingPlan}
        onGenerate={(setup) => void buildPlan(setup, 'build')}
      />

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
                      <h4 className={cn('flex min-w-0 items-center gap-1.5 truncate text-[15px] font-bold sm:text-base', task.completed && 'text-muted-foreground line-through')}>
                        {task.planId && <Sparkles className="size-3.5 shrink-0 text-primary" />}
                        <span className="truncate">{task.title}</span>
                      </h4>
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
