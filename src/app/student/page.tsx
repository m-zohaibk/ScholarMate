'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Calendar, Clock, Trophy, Zap } from 'lucide-react';
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

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold">Hello, Learner</h1>
          <p className="text-muted-foreground">Ready to tackle your study sessions today?</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild><Link href="/student/schedule">View Calendar</Link></Button>
          <Button className="bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20" asChild><Link href="/student/notes">Create New Notes</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-gradient-to-br from-primary to-primary/80 text-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1"><p className="text-primary-foreground/80 text-sm font-medium">Study Streak</p><p className="text-4xl font-bold">{completedTasks.length ? `${Math.min(completedTasks.length, 12)} Days` : '0 Days'}</p></div>
              <div className="bg-white/20 p-3 rounded-2xl"><Trophy className="w-6 h-6" /></div>
            </div>
            <div className="mt-6 text-sm text-primary-foreground/90 bg-white/10 p-2 rounded-lg text-center">Keep completing tasks to build your streak.</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm"><CardContent className="pt-6"><div className="flex justify-between items-start"><div className="space-y-1"><p className="text-muted-foreground text-sm font-medium">Completed Quizzes</p><p className="text-4xl font-bold">{attempts.length}</p></div><div className="bg-accent/10 p-3 rounded-2xl text-accent"><Zap className="w-6 h-6" /></div></div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="pt-6"><div className="flex justify-between items-start"><div className="space-y-1"><p className="text-muted-foreground text-sm font-medium">Time Studied</p><p className="text-4xl font-bold">{Math.floor(studiedMinutes / 60)}h {studiedMinutes % 60}m</p></div><div className="bg-green-100 p-3 rounded-2xl text-green-600"><Clock className="w-6 h-6" /></div></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="border-none shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="font-headline">Recent Study Assets</CardTitle><Button variant="ghost" size="sm" asChild><Link href="/student/notes">View All <ArrowRight className="w-4 h-4 ml-1" /></Link></Button></CardHeader>
          <CardContent>
            {recentActivities.length ? <div className="space-y-4">{recentActivities.map((activity) => <Link href={activity.href} key={activity.id} className="flex items-center justify-between p-4 rounded-xl border bg-white/50 hover:bg-white transition-all group"><div className="flex items-center gap-4"><div className="p-3 bg-background rounded-xl group-hover:bg-primary/5"><activity.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary" /></div><div><p className="font-medium">{activity.title}</p><p className="text-xs text-muted-foreground">{activity.type} · {new Date(activity.date).toLocaleDateString()}</p></div></div><ArrowRight className="w-4 h-4" /></Link>)}</div> : <div className="py-12 text-center text-muted-foreground"><BookOpen className="mx-auto mb-3 h-8 w-8" /><p>No study activity yet.</p><p className="text-sm mt-1">Generate notes or complete a quiz to see it here.</p></div>}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm"><CardHeader><CardTitle className="font-headline">Upcoming Challenges</CardTitle></CardHeader><CardContent className="space-y-4"><div className="p-4 rounded-xl bg-accent/5 border border-accent/10 space-y-3"><div className="flex items-center gap-2 text-accent"><Calendar className="w-4 h-4" /><span className="text-sm font-bold">Today&apos;s Goal</span></div><p className="text-sm font-medium">Complete one focused study task to keep your progress moving.</p><Button size="sm" className="w-full bg-accent hover:bg-accent/90" asChild><Link href="/student/quizzes">Go to Quizzes</Link></Button></div><div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3"><div className="flex items-center gap-2 text-primary"><Clock className="w-4 h-4" /><span className="text-sm font-bold">Study Plan</span></div><p className="text-sm font-medium">{tasks.find((task) => !task.completed)?.title || 'Add a task to your schedule.'}</p><Button size="sm" variant="outline" className="w-full" asChild><Link href="/student/schedule">View Schedule</Link></Button></div></CardContent></Card>
      </div>
    </div>
  );
}
