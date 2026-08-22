'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileCheck, History, PenTool, Users } from 'lucide-react';
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
    { label: 'Generated Quizzes', value: quizzes.length, icon: FileCheck, color: 'text-primary bg-primary/10' },
    { label: 'Question Bank', value: questionCount, icon: Users, color: 'text-accent bg-accent/10' },
    { label: 'Published Quizzes', value: quizzes.filter((quiz) => quiz.published).length, icon: History, color: 'text-green-600 bg-green-50' },
  ];

  return <div className="space-y-8 max-w-6xl mx-auto">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4"><div><h1 className="font-headline text-3xl font-bold">Welcome, Professor</h1><p className="text-muted-foreground">Manage assessments and monitor the content you create.</p></div><Button size="lg" className="rounded-xl shadow-lg shadow-primary/20" asChild><Link href="/teacher/quizzes"><PenTool className="w-4 h-4 mr-2" />Generate New Quiz</Link></Button></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{stats.map((stat) => <Card key={stat.label} className="border-none shadow-sm"><CardContent className="pt-6 flex items-center gap-4"><div className={`p-3 rounded-xl ${stat.color}`}><stat.icon className="w-6 h-6" /></div><div><p className="text-sm font-medium text-muted-foreground">{stat.label}</p><p className="text-2xl font-bold">{stat.value}</p></div></CardContent></Card>)}</div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="border-none shadow-sm"><CardHeader className="flex flex-row items-start justify-between"><div><CardTitle className="font-headline">Recent Quizzes</CardTitle><CardDescription>Your latest generated assessments.</CardDescription></div><Button variant="ghost" size="sm" asChild><Link href="/teacher/quizzes">Create</Link></Button></CardHeader><CardContent>{quizzes.length ? <div className="space-y-4">{quizzes.slice(0, 5).map((quiz) => <Link key={quiz.id} href="/teacher/quizzes" className="flex items-center justify-between p-4 rounded-xl border bg-white/50 hover:bg-white transition-colors group"><div className="flex items-center gap-3"><div className="p-2 bg-background rounded-lg group-hover:bg-primary/10"><FileCheck className="w-5 h-5 text-muted-foreground group-hover:text-primary" /></div><div><p className="font-medium">{quiz.title}</p><p className="text-xs text-muted-foreground">{quiz.questions.length} questions · {quiz.published ? 'Published' : 'Draft'}</p></div></div><span className="text-xs text-muted-foreground">{new Date(quiz.createdAt).toLocaleDateString()}</span></Link>)}</div> : <div className="py-10 text-center text-muted-foreground"><FileCheck className="mx-auto mb-3 h-8 w-8" /><p>No quizzes generated yet.</p><Button className="mt-4" asChild><Link href="/teacher/quizzes">Generate your first quiz</Link></Button></div>}</CardContent></Card>
      <Card className="border-none shadow-sm"><CardHeader><CardTitle className="font-headline">Quick Actions</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4"><Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl" asChild><Link href="/teacher/quizzes"><PenTool className="w-6 h-6" />Create Assessment</Link></Button><Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl" asChild><Link href="/teacher/quizzes#published"><History className="w-6 h-6" />Published Content</Link></Button><Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl col-span-2" asChild><Link href="/teacher/quizzes#syllabus">Import or Paste Syllabus</Link></Button></CardContent></Card>
    </div>
  </div>;
}
