'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileCheck, History, PenTool, Users, Sparkles, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getQuizzes, type StoredQuiz } from '@/lib/study-store';
import { useFirebase } from '@/firebase';
import { loadPersonalQuizzes } from '@/lib/firestore-store';

export default function TeacherDashboard() {
  const { firestore, user, isUserLoading } = useFirebase();
  const [quizzes, setQuizzes] = useState<StoredQuiz[]>([]);
  useEffect(() => {
    const refresh = () => setQuizzes(getQuizzes().filter((quiz) => quiz.source === 'teacher'));
    refresh();
    window.addEventListener('scholarmate:changed', refresh);
    return () => window.removeEventListener('scholarmate:changed', refresh);
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) return;
    loadPersonalQuizzes(firestore, user).then((remoteQuizzes) => {
      const teacherQuizzes = remoteQuizzes.filter((quiz) => quiz.source === 'teacher');
      if (teacherQuizzes.length) setQuizzes(teacherQuizzes);
    }).catch(() => undefined);
  }, [firestore, isUserLoading, user]);

  const questionCount = useMemo(() => quizzes.reduce((total, quiz) => total + quiz.questions.length, 0), [quizzes]);
  const stats = [
    { label: 'Generated Quizzes', value: quizzes.length, icon: FileCheck, iconBox: 'bg-primary/10 text-primary' },
    { label: 'Question Bank', value: questionCount, icon: Users, iconBox: 'bg-accent/10 text-accent' },
    { label: 'Published Quizzes', value: quizzes.filter((quiz) => quiz.published).length, icon: History, iconBox: 'bg-emerald-500/10 text-emerald-600' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
      {/* Welcome banner */}
      <div className="bg-mesh relative overflow-hidden rounded-3xl border border-accent/15 px-6 py-8 sm:px-8">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(60%_80%_at_20%_50%,black,transparent)]" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
              <Sparkles className="size-3" /> Teacher workspace
            </p>
            <h1 className="mt-3 font-headline text-3xl font-bold tracking-tight sm:text-4xl">Welcome, Professor</h1>
            <p className="mt-1.5 text-muted-foreground">Manage assessments and monitor the content you create.</p>
          </div>
          <Button size="lg" className="w-full rounded-2xl shadow-xl shadow-primary/25 sm:w-auto" asChild>
            <Link href="/teacher/quizzes"><PenTool className="mr-2 size-4" /> Generate New Quiz</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="card-lift border-border/60">
            <CardContent className="flex items-center gap-4 p-5 sm:p-6">
              <span className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl ${stat.iconBox}`}>
                <stat.icon className="size-6" />
              </span>
              <span>
                <span className="block text-[13px] font-medium text-muted-foreground">{stat.label}</span>
                <span className="block font-headline text-3xl font-bold tracking-tight">{stat.value}</span>
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        {/* Recent quizzes */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
            <div>
              <CardTitle className="font-headline text-lg">Recent Quizzes</CardTitle>
              <CardDescription>Your latest generated assessments.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="rounded-xl" asChild>
              <Link href="/teacher/quizzes">Create <ArrowRight className="ml-1 size-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {quizzes.length ? (
              <div className="space-y-2.5">
                {quizzes.slice(0, 5).map((quiz) => (
                  <Link
                    key={quiz.id}
                    href="/teacher/quizzes"
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white/60 p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md sm:p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                        <FileCheck className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{quiz.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {quiz.questions.length} questions · {quiz.published ? 'Published' : 'Draft'}
                        </span>
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{new Date(quiz.createdAt).toLocaleDateString()}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-muted-foreground">
                <span className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-muted"><FileCheck className="size-7" /></span>
                <p className="font-medium text-foreground">No quizzes generated yet.</p>
                <Button className="mt-4 rounded-2xl" asChild><Link href="/teacher/quizzes">Generate your first quiz</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-headline text-lg">Quick Actions</CardTitle>
            <CardDescription>Jump straight into the assessment workflow.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3.5">
            <Button variant="outline" className="card-lift h-28 flex-col gap-2.5 rounded-3xl border-border/60 bg-white/60 text-sm font-semibold" asChild>
              <Link href="/teacher/quizzes"><PenTool className="size-6 text-primary" /> Create Assessment</Link>
            </Button>
            <Button variant="outline" className="card-lift h-28 flex-col gap-2.5 rounded-3xl border-border/60 bg-white/60 text-sm font-semibold" asChild>
              <Link href="/teacher/quizzes#published"><History className="size-6 text-accent" /> Published Content</Link>
            </Button>
            <Button variant="outline" className="card-lift col-span-2 h-20 flex-row gap-2.5 rounded-3xl border-primary/20 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10" asChild>
              <Link href="/teacher/quizzes#syllabus"><Sparkles className="size-5" /> Import or Paste Syllabus</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
