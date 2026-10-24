'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { useFirebase } from '@/firebase';
import { getUserProfile, type UserProfile } from '@/lib/auth-profile';
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
  Target,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AppShellProps {
  role: 'teacher' | 'student';
  children: React.ReactNode;
}

const NAV = {
  student: [
    { label: 'Dashboard', href: '/student', icon: LayoutDashboard, blurb: 'Overview & activity' },
    { label: 'Study Notes', href: '/student/notes', icon: FileText, blurb: 'AI-structured notes' },
    { label: 'Quizzes', href: '/student/quizzes', icon: PenTool, blurb: 'Test yourself' },
    { label: 'Weak Areas', href: '/student/weak-areas', icon: Target, blurb: 'Knowledge-gap detection' },
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
      <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30 ring-1 ring-white/40">
        <GraduationCap className="size-5" />
        <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-white text-accent shadow"><Sparkles className="size-2.5" /></span>
      </span>
      <span className="leading-tight">
        <span className="block font-headline text-[17px] font-bold tracking-tight text-white">
          ScholarMate
        </span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
          Smart Academic Assistant
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
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#12255a]',
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
              <span className={cn('block truncate text-[11px]', active ? 'text-slate-500' : 'text-white/60')}>
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
  const router = useRouter();
  const { auth, firestore, user } = useFirebase();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(firestore, user.uid).then(setProfile).catch(() => undefined);
  }, [firestore, user]);

  const handleSignOut = async () => {
    onNavigate?.();
    try {
      if (auth) await firebaseSignOut(auth);
    } catch {
      // Still leave the portal even if the sign-out call hiccups.
    }
    router.push('/login');
  };

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
          <span className="block text-[11px] text-white/65">Powered by AI</span>
        </span>
      </div>
      <NavItems role={role} onNavigate={onNavigate} />
      <div className="space-y-1.5 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-2xl px-4 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
            {(profile?.name || user?.email || 'U').charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-white">{profile?.name || 'My account'}</span>
            <span className="block truncate text-[11px] text-white/65">{user?.email || ''}</span>
          </span>
        </div>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#12255a]"
        >
          <Home className="size-5 shrink-0 text-white/60" /> Home
        </Link>
        <ThemeToggle variant="onDark" withLabel />
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#12255a]"
        >
          <LogOut className="size-5 shrink-0 text-white/60" /> Sign out
        </button>
      </div>
    </div>
  );
}

export function AppShell({ role, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 shadow-[24px_0_48px_-28px_rgb(8_18_40/0.45)] lg:block">
        <SidebarBody role={role} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl lg:hidden">
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
            <span className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/25 ring-1 ring-white/40">
              <GraduationCap className="size-5" />
              <span className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full bg-white text-accent shadow"><Sparkles className="size-2" /></span>
            </span>
            <span className="font-headline text-lg font-bold tracking-tight">
              Scholar<span className="text-gradient">Mate</span>
            </span>
          </Link>
          <ThemeToggle className="ml-auto" />
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
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
