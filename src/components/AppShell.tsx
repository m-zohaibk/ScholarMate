'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  PenTool,
  Calendar,
  Home,
  LogOut,
  Sparkles,
  Menu,
  GraduationCap,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface AppShellProps {
  role: 'teacher' | 'student';
  children: React.ReactNode;
}

const NAV = {
  student: [
    { label: 'Dashboard', href: '/student', icon: LayoutDashboard, blurb: 'Overview & activity' },
    { label: 'Study Notes', href: '/student/notes', icon: FileText, blurb: 'AI-structured notes' },
    { label: 'Quizzes', href: '/student/quizzes', icon: PenTool, blurb: 'Test yourself' },
    { label: 'Study Schedule', href: '/student/schedule', icon: Calendar, blurb: 'Plan sessions' },
  ],
  teacher: [
    { label: 'Dashboard', href: '/teacher', icon: LayoutDashboard, blurb: 'Overview & content' },
    { label: 'Quiz Generator', href: '/teacher/quizzes', icon: PenTool, blurb: 'Build assessments' },
  ],
} as const;

function BrandBlock() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30">
        <Sparkles className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="block font-headline text-[17px] font-bold tracking-tight text-white">
          ScholarMate
        </span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
          AI Academic Hub
        </span>
      </span>
    </Link>
  );
}

function NavItems({ role, onNavigate }: { role: 'teacher' | 'student'; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
      {NAV[role].map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200',
              active
                ? 'bg-white text-primary shadow-lg shadow-black/20'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            <item.icon className={cn('size-5 shrink-0', active ? 'text-primary' : 'text-white/60 group-hover:text-white')} />
            <span className="min-w-0">
              <span className={cn('block truncate text-sm font-semibold', active ? 'text-slate-900' : 'text-white')}>
                {item.label}
              </span>
              <span className={cn('block truncate text-[11px]', active ? 'text-slate-500' : 'text-white/50')}>
                {item.blurb}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ role, onNavigate }: { role: 'teacher' | 'student'; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0d1b3e] via-[#12255a] to-[#1a2f6e]">
      <div className="px-5 pb-2 pt-6">
        <BrandBlock />
      </div>
      <div className="mx-5 mt-4 flex items-center gap-2.5 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white">
          <GraduationCap className="size-5" />
        </span>
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold text-white">
            {role === 'teacher' ? 'Teacher' : 'Student'} Workspace
          </span>
          <span className="block text-[11px] text-white/55">Powered by AI</span>
        </span>
      </div>
      <NavItems role={role} onNavigate={onNavigate} />
      <div className="space-y-1.5 border-t border-white/10 p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Home className="size-5 shrink-0 text-white/60" /> Home
        </Link>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-5 shrink-0 text-white/60" /> Exit Module
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ role, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 lg:block">
        <SidebarBody role={role} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center gap-3 px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation" className="rounded-xl">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] border-0 p-0 sm:max-w-sm">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarBody role={role} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/25">
              <Sparkles className="size-4" />
            </span>
            <span className="font-headline text-lg font-bold tracking-tight">
              Scholar<span className="text-gradient">Mate</span>
            </span>
          </Link>
          <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            {role}
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="lg:pl-72">
        <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
