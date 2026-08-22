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

  return <div className="max-w-6xl mx-auto space-y-8">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4"><div><h1 className="font-headline text-3xl font-bold">Study Planner</h1><p className="text-muted-foreground">Plan, track, and improve your learning sessions.</p></div><Button className="bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20" onClick={optimize}><Sparkles className="w-4 h-4 mr-2" />AI Optimize Schedule</Button></div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8"><div className="lg:col-span-4"><Card className="border-none shadow-sm"><CardContent className="p-4"><Calendar mode="single" selected={date} onSelect={(next) => next && setDate(next)} className="rounded-md" /></CardContent></Card><Card className="border-none shadow-sm mt-6"><CardHeader><CardTitle className="text-lg">Daily Goals</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Focus Time</span><span className="font-bold">{Math.floor(focusMinutes / 60)}h {focusMinutes % 60}m / {Math.floor(goalMinutes / 60)}h</span></div><div className="w-full bg-muted rounded-full h-2 overflow-hidden"><div className="bg-primary h-full transition-all" style={{ width: `${Math.min(100, Math.round((focusMinutes / goalMinutes) * 100))}%` }} /></div><div className="grid grid-cols-2 gap-2 mt-4"><div className="p-3 bg-primary/5 rounded-xl text-center"><p className="text-xl font-bold text-primary">{completed.length}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Completed</p></div><div className="p-3 bg-accent/5 rounded-xl text-center"><p className="text-xl font-bold text-accent">{dayTasks.length - completed.length}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Remaining</p></div></div></CardContent></Card></div>
    <div className="lg:col-span-8 space-y-6"><Card className="border-none shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="font-headline">Schedule for {formatDateLabel(date)}</CardTitle><CardDescription>Keep each session short, focused, and actionable.</CardDescription></div><Badge variant="outline" className="flex gap-1 text-primary border-primary/20"><Bell className="w-3 h-3" /> Reminders Active</Badge></CardHeader><CardContent className="space-y-0 p-0">{dayTasks.length ? dayTasks.map((task) => <div key={task.id} className="group flex items-start gap-4 p-6 border-b last:border-0 hover:bg-primary/5 transition-colors"><div className="text-sm font-bold text-muted-foreground w-16 pt-1">{task.time}</div><div className="flex-1 space-y-1"><div className="flex items-center justify-between gap-3"><h4 className={cn('font-bold text-lg', task.completed && 'text-muted-foreground line-through')}>{task.title}</h4><Badge variant="secondary" className="font-medium">{task.category}</Badge></div><div className="flex items-center gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.duration}</span></div></div><button type="button" aria-label={task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} onClick={() => toggleTask(task.id)} className={cn('p-2 rounded-xl transition-all', task.completed ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary')}>{task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}</button></div>) : <div className="p-12 text-center text-muted-foreground"><Calendar className="mx-auto mb-3 h-8 w-8" /><p>No tasks planned for this day.</p></div>}
      {showForm ? <form onSubmit={addTask} className="m-6 rounded-xl border bg-background p-4 space-y-4"><div className="flex justify-between items-center"><h3 className="font-semibold">Add study task</h3><Button type="button" variant="ghost" size="icon" onClick={() => setShowForm(false)} aria-label="Close"><X className="w-4 h-4" /></Button></div><div className="grid sm:grid-cols-2 gap-3"><div className="space-y-1 sm:col-span-2"><Label htmlFor="task-title">Task title</Label><Input id="task-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Review biology chapter" autoFocus /></div><div className="space-y-1"><Label htmlFor="task-time">Start time</Label><Input id="task-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div><div className="space-y-1"><Label htmlFor="task-duration">Duration</Label><Input id="task-duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 45m" /></div><div className="space-y-1 sm:col-span-2"><Label htmlFor="task-category">Category</Label><Input id="task-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div></div><Button type="submit" className="w-full" disabled={!form.title.trim()}>Save Task</Button></form> : <div className="p-8 flex flex-col items-center justify-center text-center"><Button type="button" variant="outline" className="rounded-full h-12 w-12 p-0 border border-dashed mb-2" onClick={() => setShowForm(true)} aria-label="Add task"><Plus className="h-5 w-5" /></Button><p className="text-sm font-medium">Add task for {formatDateLabel(date)}</p></div>}</CardContent></Card></div></div>
  </div>;
}
