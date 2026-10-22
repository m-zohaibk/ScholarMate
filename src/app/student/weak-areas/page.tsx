'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BookOpen, PenTool, Sparkles, Target, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  getAttempts,
  getNotes,
  getSources,
  setStudySeed,
  type QuizAttempt,
  type StoredNote,
  type StoredSource,
} from '@/lib/study-store';
import { useFirebase } from '@/firebase';
import { loadAttempts } from '@/lib/firestore-store';
import { getTopicStats, type TopicStat } from '@/lib/analytics';

function noteAsText(note: StoredNote) {
  return [note.title, '', note.summary, '', ...note.sections.flatMap((section) => [section.heading, ...section.subsections.flatMap((subsection) => [subsection.subheading, ...subsection.points.map((point) => `• ${point}`)])])].join('\n');
}

function titlesMatch(a: string, b: string) {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || (left.length >= 4 && right.includes(left)) || (right.length >= 4 && left.includes(right));
}

const STATUS_STYLES: Record<TopicStat['status'], { chip: string; bar: string }> = {
  Weak: { chip: 'bg-red-500/10 text-red-600', bar: '[&>div]:bg-red-500' },
  Improving: { chip: 'bg-amber-500/10 text-amber-600', bar: '[&>div]:bg-amber-500' },
  Strong: { chip: 'bg-emerald-500/10 text-emerald-600', bar: '[&>div]:bg-emerald-500' },
};

export default function WeakAreasPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { firestore, user, isUserLoading } = useFirebase();
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [sources, setSources] = useState<StoredSource[]>([]);
  const [notes, setNotes] = useState<StoredNote[]>([]);

  useEffect(() => {
    const refresh = () => {
      setAttempts(getAttempts());
      setSources(getSources());
      setNotes(getNotes());
    };
    refresh();
    window.addEventListener('scholarmate:changed', refresh);
    return () => window.removeEventListener('scholarmate:changed', refresh);
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) return;
    loadAttempts(firestore, user).then((remoteAttempts) => {
      if (remoteAttempts.length) setAttempts(remoteAttempts);
    }).catch(() => undefined);
  }, [firestore, isUserLoading, user]);

  const stats = useMemo(() => getTopicStats(attempts), [attempts]);
  const weakCount = stats.filter((stat) => stat.status === 'Weak').length;
  const improvingCount = stats.filter((stat) => stat.status === 'Improving').length;
  const strongCount = stats.filter((stat) => stat.status === 'Strong').length;

  /** Find the best material for a topic: a library source first, then a saved note. */
  const resolveMaterial = (topic: string) => {
    for (const source of sources) {
      const matchedTopic = source.topics.find((item) => titlesMatch(item.title, topic));
      if (matchedTopic) return { sourceId: source.id, topicTitle: matchedTopic.title } as const;
      if (titlesMatch(source.name.replace(/\.[^.]+$/, ''), topic)) {
        return { sourceId: source.id, topicTitle: source.topics[0]?.title } as const;
      }
    }
    const note = notes.find((item) => titlesMatch(item.title, topic) || titlesMatch(item.sourceName.replace(/\.[^.]+$/, ''), topic));
    if (note) return { text: noteAsText(note) } as const;
    return null;
  };

  const practice = (stat: TopicStat) => {
    const material = resolveMaterial(stat.topic);
    if (material && 'sourceId' in material) {
      setStudySeed({ target: 'quiz', label: `Practice: ${stat.topic}`, sourceId: material.sourceId, topicTitle: material.topicTitle, topic: stat.topic });
    } else if (material && 'text' in material) {
      setStudySeed({ target: 'quiz', label: `Practice from your notes: ${stat.topic}`, text: material.text, topic: stat.topic });
    } else {
      setStudySeed({ target: 'quiz', label: `Practice: ${stat.topic}`, text: `Topic: ${stat.topic}. Generate a focused practice quiz on this topic.`, topic: stat.topic });
      toast({ title: 'Topic practice', description: 'No saved material matched this topic, so the quiz is generated from the topic name. Add the source file for material-based questions.' });
    }
    router.push('/student/quizzes');
  };

  const revise = (stat: TopicStat) => {
    const material = resolveMaterial(stat.topic);
    if (material && 'sourceId' in material) {
      setStudySeed({ target: 'notes', label: `Revision notes: ${stat.topic}`, sourceId: material.sourceId, topicTitle: material.topicTitle, topic: stat.topic });
    } else if (material && 'text' in material) {
      setStudySeed({ target: 'notes', label: `Revision notes: ${stat.topic}`, text: material.text, topic: stat.topic });
    } else {
      setStudySeed({ target: 'notes', label: `Revision notes: ${stat.topic}`, text: `Topic: ${stat.topic}. Write focused revision notes on this topic.`, topic: stat.topic });
      toast({ title: 'Topic revision', description: 'No saved material matched this topic, so the notes are generated from the topic name. Add the source file for material-based notes.' });
    }
    router.push('/student/notes');
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
      <div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
          <Target className="size-3" /> Knowledge-Gap Detection
        </p>
        <h1 className="mt-2.5 font-headline text-3xl font-bold tracking-tight sm:text-4xl">Your Weak Areas</h1>
        <p className="mt-1.5 max-w-2xl text-muted-foreground">
          Every quiz you finish updates this page automatically. Topics are scored from all your attempts — no extra work, just practice where it counts.
        </p>
      </div>

      {stats.length === 0 ? (
        <Card className="border-border/60 p-8 text-center sm:p-12">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-muted"><Target className="size-7 text-muted-foreground" /></span>
          <h2 className="mt-5 font-headline text-xl font-bold">No topic data yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Take your first quiz and your topic strengths and weak areas will appear here automatically.
          </p>
          <Button className="mt-6 rounded-2xl" asChild>
            <a href="/student/quizzes"><PenTool className="mr-2 size-4" /> Go to Quizzes</a>
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <Card className="border-border/60">
              <CardContent className="p-4 text-center sm:p-5">
                <p className="font-headline text-3xl font-bold text-red-500">{weakCount}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">Weak topics</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center sm:p-5">
                <p className="font-headline text-3xl font-bold text-amber-500">{improvingCount}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">Improving</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center sm:p-5">
                <p className="font-headline text-3xl font-bold text-emerald-500">{strongCount}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">Strong</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {stats.map((stat) => {
              const styles = STATUS_STYLES[stat.status];
              return (
                <Card key={stat.topic} className="card-lift border-border/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="min-w-0 truncate text-base">{stat.topic}</CardTitle>
                      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide', styles.chip)}>
                        {stat.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-end justify-between gap-3">
                      <p className="font-headline text-4xl font-bold tracking-tight">
                        {stat.avgPct}
                        <span className="text-lg text-muted-foreground">%</span>
                      </p>
                      <p className="text-right text-xs leading-relaxed text-muted-foreground">
                        average · {stat.attempts} attempt{stat.attempts === 1 ? '' : 's'}
                        <br />
                        last tried {new Date(stat.lastAttemptAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Progress value={stat.avgPct} className={cn('h-2.5 rounded-full', styles.bar)} />
                    {stat.attempts > 1 && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <TrendingUp className="size-3.5 text-primary" />
                        Your journey: first attempt {stat.firstPct}% → latest {stat.latestPct}% · best {stat.bestPct}%
                      </p>
                    )}
                    {stat.status !== 'Strong' ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        <Button className="rounded-xl" onClick={() => practice(stat)}>
                          <PenTool className="mr-1.5 size-4" /> {stat.attempts > 1 ? 'Re-check quiz' : 'Practice quiz'}
                        </Button>
                        <Button variant="outline" className="rounded-xl" onClick={() => revise(stat)}>
                          <BookOpen className="mr-1.5 size-4" /> Revision notes
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full rounded-xl" onClick={() => practice(stat)}>
                        <Sparkles className="mr-1.5 size-4" /> Practice at a harder level
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
