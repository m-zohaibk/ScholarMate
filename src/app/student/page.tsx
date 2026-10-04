'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Calendar, Clock, Trophy, Zap, Sparkles, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAttempts, getNotes, getTasks, type QuizAttempt, type StoredNote, type StudyTask } from '@/lib/study-store';
import { useFirebase } from '@/firebase';
import { loadAttempts, loadNotes, loadTasks } from '@/lib/firestore-store';

function minutesFromDuration(duration: string) {
  const hours = duration.match(/(\d+(?:\.\d+)?)h/)?.[1];
  const minutes = duration.match(/(\d+)m/)?.[1];
  return Number(hours || 0) * 60 + Number(minutes || 0);
}

export default function StudentDashboard() {
  const { firestore, user, isUserLoading } = useFirebase();
  const [notes, setNotes] = useState<StoredNote[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);

  useEffect(() => {
    const refresh = () => {
      setNotes(getNotes());
      setAttempts(getAttempts());
      setTasks(getTasks());
    };
    refresh();
    window.addEventListener('scholarmate:changed', refresh);
    return () => window.removeEventListener('scholarmate:changed', refresh);
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) return;
    Promise.all([loadNotes(firestore, user), loadAttempts(firestore, user), loadTasks(firestore, user)]).then(([remoteNotes, remoteAttempts, remoteTasks]) => {
      if (remoteNotes.length) setNotes(remoteNotes);
      if (remoteAttempts.length) setAttempts(remoteAttempts);
      if (remoteTasks.length) setTasks(remoteTasks);
    }).catch(() => undefined);
  }, [firestore, isUserLoading, user]);

  const completedTasks = tasks.filter((task) => task.completed);
  const studiedMinutes = completedTasks.reduce((total, task) => total + minutesFromDuration(task.duration), 0);
  const recentActivities = useMemo(() => [
    ...notes.map((note) => ({ id: note.id, title: note.title, type: 'Notes', date: note.createdAt, href: '/student/notes', icon: BookOpen })),
    ...attempts.map((attempt) => ({ id: attempt.id, title: attempt.quizTitle, type: `Quiz · ${attempt.score}/${attempt.total}`, date: attempt.completedAt, href: '/student/quizzes', icon: Zap })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4), [attempts, notes]);

  const stats = [
    {
      label: 'Study Streak',
      value: completedTasks.length ? `${Math.min(completedTasks.length, 12)} Days` : '0 Days',
      icon: Trophy,
      card: 'border-0 bg-gradient-to-br from-primary via-[#2f6fd6] to-accent text-white shadow-xl shadow-primary/25',
      iconBox: 'bg-white/20 text-white',
      sub: 'Keep completing tasks to build your streak.',
    },
    {
      label: 'Completed Quizzes',
      value: String(attempts.length),
      icon: Zap,
      card: 'border-border/60 bg-card',
      iconBox: 'bg-accent/10 text-accent',
      sub: 'Quizzes finished with AI feedback.',
    },
    {
      label: 'Time Studied',
      value: `${Math.floor(studiedMinutes / 60)}h ${studiedMinutes % 60}m`,
      icon: Clock,
      card: 'border-border/60 bg-card',
      iconBox: 'bg-emerald-500/10 text-emerald-600',
      sub: 'Focused time from completed tasks.',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
      {/* Welcome banner */}
      <div className="bg-mesh relative overflow-hidden rounded-3xl border border-primary/15 px-6 py-8 sm:px-8">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(60%_80%_at_20%_50%,black,transparent)]" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="size-3" /> Student workspace
            </p>
            <h1 className="mt-3 font-headline text-3xl font-bold tracking-tight sm:text-4xl">Hello, Learner</h1>
            <p className="mt-1.5 text-muted-foreground">Ready to tackle your study sessions today?</p>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row md:flex-col lg:flex-row">
            <Button variant="outline" className="rounded-2xl bg-white/70 backdrop-blur" asChild>
              <Link href="/student/schedule"><Calendar className="mr-2 size-4" /> View Calendar</Link>
            </Button>
            <Button className="rounded-2xl shadow-lg shadow-accent/25" asChild>
              <Link href="/student/notes"><Sparkles className="mr-2 size-4" /> Create New Notes</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {stats.map((s) => (
          <Card key={s.label} className={`card-lift overflow-hidden ${s.card}`}>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[13px] font-medium opacity-70">{s.label}</p>
                  <p className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">{s.value}</p>
                </div>
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${s.iconBox}`}>
                  <s.icon className="size-6" />
                </span>
              </div>
              <p className="mt-4 rounded-xl bg-black/5 px-3 py-2 text-center text-xs font-medium opacity-80 dark:bg-white/10">
                {s.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        {/* Recent activity */}
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="font-headline text-lg">Recent Study Assets</CardTitle>
            <Button variant="ghost" size="sm" className="rounded-xl" asChild>
              <Link href="/student/notes">View All <ArrowRight className="ml-1 size-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentActivities.length ? (
              <div className="space-y-2.5">
                {recentActivities.map((activity) => (
                  <Link
                    href={activity.href}
                    key={activity.id}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white/60 p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md sm:p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                        <activity.icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{activity.title}</span>
                        <span className="block text-xs text-muted-foreground">{activity.type} · {new Date(activity.date).toLocaleDateString()}</span>
                      </span>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <span className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-muted"><BookOpen className="size-7" /></span>
                <p className="font-medium text-foreground">No study activity yet.</p>
                <p className="mt-1 text-sm">Generate notes or complete a quiz to see it here.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Challenges */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-headline text-lg">
              <Target className="size-5 text-accent" /> Upcoming Challenges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div className="space-y-3 rounded-2xl border border-accent/15 bg-accent/5 p-4">
              <div className="flex items-center gap-2 text-accent">
                <Calendar className="size-4" />
                <span className="text-[13px] font-bold">Today&apos;s Goal</span>
              </div>
              <p className="text-sm font-medium leading-relaxed">Complete one focused study task to keep your progress moving.</p>
              <Button size="sm" className="w-full rounded-xl" asChild>
                <Link href="/student/quizzes">Go to Quizzes</Link>
              </Button>
            </div>
            <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-primary">
                <Clock className="size-4" />
                <span className="text-[13px] font-bold">Study Plan</span>
              </div>
              <p className="truncate text-sm font-medium">{tasks.find((task) => !task.completed)?.title || 'Add a task to your schedule.'}</p>
              <Button size="sm" variant="outline" className="w-full rounded-xl bg-white/70" asChild>
                <Link href="/student/schedule">View Schedule</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
