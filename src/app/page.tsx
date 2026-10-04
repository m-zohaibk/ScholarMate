import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Sparkles,
  Zap,
  ClipboardList,
  CalendarClock,
  ScanText,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  BookOpen,
  Menu,
  FileText,
  Brain,
  PenTool,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const FEATURES = [
  {
    icon: Zap,
    title: 'AI Quiz Generator',
    desc: 'Generate MCQs, short answers and conceptual questions from any material in seconds — with instant feedback.',
    tint: 'bg-primary/10 text-primary',
  },
  {
    icon: ScanText,
    title: 'Handwriting OCR',
    desc: 'Gemini vision reads handwritten notes, textbook photos and complex PDFs, turning them into clean digital notes.',
    tint: 'bg-accent/10 text-accent',
  },
  {
    icon: FileText,
    title: 'Structured Notes',
    desc: 'Long chapters become hierarchical summaries with key ideas, sub-points and an executive overview.',
    tint: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    icon: ClipboardList,
    title: 'Automated Assessment',
    desc: 'Teachers paste a syllabus and get balanced, syllabus-aligned exams with answer keys and explanations.',
    tint: 'bg-amber-500/10 text-amber-600',
  },
  {
    icon: CalendarClock,
    title: 'Smart Study Planner',
    desc: 'Personalized schedules, daily goals and reminders that keep study sessions short and focused.',
    tint: 'bg-sky-500/10 text-sky-600',
  },
  {
    icon: Brain,
    title: 'Active Recall Engine',
    desc: 'Built on proven learning science — testing beats re-reading. Every quiz strengthens long-term retention.',
    tint: 'bg-rose-500/10 text-rose-600',
  },
];

const STEPS = [
  { n: '01', title: 'Upload material', desc: 'Drop in PDFs, photos of handwritten notes, DOCX or PPTX files — no size limits.' },
  { n: '02', title: 'AI does the heavy lifting', desc: 'Gemini transcribes, summarizes and structures your content into study-ready notes.' },
  { n: '03', title: 'Practice & master', desc: 'Take auto-generated quizzes with instant feedback and AI explanations until it sticks.' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/25">
              <Sparkles className="size-4" />
            </span>
            <span className="font-headline text-xl font-bold tracking-tight">
              Scholar<span className="text-gradient">Mate</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Features</Link>
            <Link href="#how" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">How it works</Link>
            <Link href="/student" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Student Hub</Link>
            <Link href="/teacher" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Teacher Hub</Link>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" asChild><Link href="/student">Sign in</Link></Button>
            <Button className="rounded-xl shadow-lg shadow-primary/25" asChild>
              <Link href="/student">Get started <ArrowRight className="ml-1 size-4" /></Link>
            </Button>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl md:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader><SheetTitle className="text-left font-headline">Menu</SheetTitle></SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {[
                  { href: '#features', label: 'Features' },
                  { href: '#how', label: 'How it works' },
                  { href: '/student', label: 'Student Hub' },
                  { href: '/teacher', label: 'Teacher Hub' },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="rounded-xl px-4 py-3 text-[15px] font-medium hover:bg-muted">
                    {l.label}
                  </Link>
                ))}
                <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                  <Button variant="outline" asChild><Link href="/student">Sign in</Link></Button>
                  <Button asChild><Link href="/student">Get started</Link></Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="bg-mesh relative overflow-hidden">
          <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(70%_60%_at_50%_35%,black,transparent)]" />
          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:pb-24 lg:pt-24">
            <div className="mx-auto max-w-4xl text-center">
              <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-4 py-1.5 text-[13px] font-semibold text-primary shadow-sm backdrop-blur">
                <Sparkles className="size-3.5" />
                AI-powered study companion for students & teachers
              </div>
              <h1 className="animate-fade-up delay-100 mt-6 font-headline text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-7xl">
                Turn any notes into
                <br />
                <span className="text-gradient animate-gradient-pan bg-[linear-gradient(100deg,hsl(var(--primary)),hsl(var(--accent)),hsl(var(--primary)))]">
                  smarter studying
                </span>
              </h1>
              <p className="animate-fade-up delay-200 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Upload PDFs, handwritten pages or slides — ScholarMate transcribes them,
                builds structured notes and generates quizzes with instant AI feedback.
              </p>
              <div className="animate-fade-up delay-300 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" className="h-12 w-full rounded-2xl px-8 text-base font-semibold shadow-xl shadow-primary/30 sm:w-auto" asChild>
                  <Link href="/student"><BookOpen className="mr-2 size-5" /> I&apos;m a Student</Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 w-full rounded-2xl bg-white/70 px-8 text-base font-semibold backdrop-blur sm:w-auto" asChild>
                  <Link href="/teacher"><GraduationCap className="mr-2 size-5" /> I&apos;m a Teacher</Link>
                </Button>
              </div>
              <div className="animate-fade-up delay-300 mt-10 grid grid-cols-3 gap-4 sm:gap-8">
                {[
                  { v: '40%', l: 'Less prep time' },
                  { v: '3', l: 'Question types' },
                  { v: '∞', l: 'File size limit*' },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl border border-border/60 bg-white/60 px-2 py-4 backdrop-blur">
                    <p className="font-headline text-2xl font-bold text-primary sm:text-3xl">{s.v}</p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground sm:text-xs">{s.l}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground">*via Gemini Files API for PDFs</p>
            </div>

            {/* Floating preview cards */}
            <div className="relative mx-auto mt-14 hidden max-w-5xl lg:block">
              <div className="glass animate-float-slow absolute -left-4 top-6 z-10 w-64 rounded-3xl p-5 shadow-xl">
                <div className="flex items-center gap-2 text-primary"><PenTool className="size-4" /><p className="text-xs font-bold uppercase tracking-wider">Quiz ready</p></div>
                <p className="mt-2 text-sm font-semibold">Photosynthesis — 10 questions</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-4/5 rounded-full bg-gradient-to-r from-primary to-accent" /></div>
                <p className="mt-2 text-xs text-muted-foreground">Score 8/10 · Explanations included</p>
              </div>
              <div className="glass animate-float-slow absolute -right-4 top-16 z-10 w-64 rounded-3xl p-5 shadow-xl [animation-delay:1.8s]">
                <div className="flex items-center gap-2 text-accent"><FileText className="size-4" /><p className="text-xs font-bold uppercase tracking-wider">Notes generated</p></div>
                <p className="mt-2 text-sm font-semibold">Chapter 4 — structured summary</p>
                <div className="mt-3 space-y-1.5">
                  <div className="h-2 w-full rounded-full bg-muted" /><div className="h-2 w-5/6 rounded-full bg-muted" /><div className="h-2 w-4/6 rounded-full bg-muted" />
                </div>
              </div>
              <div className="glass mx-auto max-w-2xl rounded-3xl p-6 shadow-2xl sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><ScanText className="size-5" /></span>
                  <div>
                    <p className="font-headline font-bold">Handwriting → digital notes</p>
                    <p className="text-sm text-muted-foreground">biology_notes_page3.jpg · processed in 4s</p>
                  </div>
                  <CheckCircle2 className="ml-auto size-6 text-emerald-500" />
                </div>
                <div className="mt-5 rounded-2xl bg-muted/60 p-5 text-left">
                  <p className="font-headline text-sm font-bold text-primary">Key concepts extracted</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    <li>• Chlorophyll absorbs light in the thylakoid membrane</li>
                    <li>• Calvin cycle fixes CO₂ into glucose in the stroma</li>
                    <li>• Factors: light intensity, CO₂ concentration, temperature</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Features</p>
            <h2 className="mt-3 font-headline text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to <span className="text-gradient">learn faster</span>
            </h2>
            <p className="mt-4 text-muted-foreground">One platform for the full study loop — capture, understand, practice, repeat.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="card-lift group border-border/60 bg-card p-6 sm:p-7">
                <div className={`inline-grid size-12 place-items-center rounded-2xl ${f.tint} transition-transform group-hover:scale-110`}>
                  <f.icon className="size-6" />
                </div>
                <h3 className="mt-5 font-headline text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="border-y border-border/60 bg-white/60">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">How it works</p>
              <h2 className="mt-3 font-headline text-3xl font-bold tracking-tight sm:text-4xl">From messy notes to mastery in 3 steps</h2>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.n} className="relative rounded-3xl border border-border/60 bg-background p-7">
                  <span className="font-headline text-5xl font-bold text-primary/15">{s.n}</span>
                  <h3 className="mt-3 font-headline text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                  {i < STEPS.length - 1 && (
                    <ArrowRight className="absolute -right-4 top-1/2 hidden size-6 -translate-y-1/2 text-primary/40 md:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Role cards ---------- */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Link href="/student" className="card-lift group relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#1a56c4] p-8 text-white sm:p-10">
              <div className="bg-grid absolute inset-0 opacity-20 [mask-image:radial-gradient(60%_60%_at_70%_20%,black,transparent)]" />
              <div className="relative">
                <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-white/15 backdrop-blur"><BookOpen className="size-6" /></span>
                <h3 className="mt-5 font-headline text-2xl font-bold sm:text-3xl">For Students</h3>
                <p className="mt-3 max-w-md text-white/80">Upload anything you study from. Get structured notes, quizzes with instant feedback and a smart schedule.</p>
                <span className="mt-6 inline-flex items-center font-semibold">Open Student Hub <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" /></span>
              </div>
            </Link>
            <Link href="/teacher" className="card-lift group relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent to-[#3f2fd1] p-8 text-white sm:p-10">
              <div className="bg-grid absolute inset-0 opacity-20 [mask-image:radial-gradient(60%_60%_at_70%_20%,black,transparent)]" />
              <div className="relative">
                <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-white/15 backdrop-blur"><GraduationCap className="size-6" /></span>
                <h3 className="mt-5 font-headline text-2xl font-bold sm:text-3xl">For Teachers</h3>
                <p className="mt-3 max-w-md text-white/80">Paste a syllabus, get balanced exams with answer keys — then publish them straight to your class.</p>
                <span className="mt-6 inline-flex items-center font-semibold">Open Teacher Hub <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" /></span>
              </div>
            </Link>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="bg-mesh relative overflow-hidden rounded-[2rem] border border-primary/15 px-6 py-14 text-center sm:px-12 lg:py-20">
            <div className="relative mx-auto max-w-2xl">
              <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">
                Stop re-reading. <span className="text-gradient">Start remembering.</span>
              </h2>
              <p className="mt-4 text-muted-foreground">Join ScholarMate and turn your study materials into an AI-powered learning loop today.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button size="lg" className="rounded-2xl px-8 shadow-xl shadow-primary/30" asChild>
                  <Link href="/student">Start learning free</Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-2xl bg-white/70 px-8 backdrop-blur" asChild>
                  <Link href="/teacher">Create an assessment</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-10 sm:px-6 md:flex-row">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
              <Sparkles className="size-4" />
            </span>
            <span className="font-headline text-lg font-bold">Scholar<span className="text-gradient">Mate</span></span>
          </Link>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-foreground">Features</Link>
            <Link href="/student" className="hover:text-foreground">Student Hub</Link>
            <Link href="/teacher" className="hover:text-foreground">Teacher Hub</Link>
          </nav>
          <p className="text-center text-xs text-muted-foreground">© 2026 ScholarMate · Smart Academic Assistant System</p>
        </div>
      </footer>
    </div>
  );
}
