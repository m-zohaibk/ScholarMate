'use client';

import Link from 'next/link';
import { BookOpen, GraduationCap, PenTool, Sparkles, Target } from 'lucide-react';

const FEATURES = [
  { icon: BookOpen, title: 'Structured notes', text: 'Complete notes generated from your own material, part by part.' },
  { icon: PenTool, title: 'Adaptive quizzes', text: 'Questions that follow your level — and typed answers graded on meaning.' },
  { icon: Target, title: 'Weak areas, fixed', text: 'Your knowledge gaps are found automatically and turned into practice.' },
];

/** The ScholarMate brand lockup: graduation-cap mark in a ringed gradient tile + Space Grotesk wordmark. */
export function BrandLockup({ dark = false, centered = false }: { dark?: boolean; centered?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-3 ${centered ? 'justify-center' : ''}`}>
      <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#257edc] via-[#3f6fe0] to-[#5e4ce6] text-white shadow-lg shadow-[#5e4ce6]/40 ring-1 ring-white/40">
        <GraduationCap className="size-6" />
        <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-white text-[#5e4ce6] shadow">
          <Sparkles className="size-2.5" />
        </span>
      </span>
      <span className="leading-none">
        <span className={`block font-headline text-[22px] font-bold tracking-tight ${dark ? 'text-[#0d1b3e]' : 'text-white'}`}>
          Scholar<span className="bg-gradient-to-r from-[#6db3ff] to-[#b7a8ff] bg-clip-text text-transparent">Mate</span>
        </span>
        <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-[0.28em] ${dark ? 'text-slate-500' : 'text-white/60'}`}>
          Smart Academic Assistant
        </span>
      </span>
    </Link>
  );
}

/**
 * Full-page auth shell: a rich branded panel beside the form on desktop, a
 * branded band on top on mobile. The page owns its entire background — the
 * form never floats over another page.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-[#eef3fa]">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden w-[44%] overflow-hidden lg:flex xl:w-[40%]">
        <div className="absolute inset-0 bg-[linear-gradient(165deg,#081228_0%,#0d1b3e_38%,#1a3f9e_78%,#5e4ce6_125%)]" />
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1.5px)', backgroundSize: '22px 22px' }}
        />
        <div className="absolute -left-24 top-1/3 size-80 rounded-full bg-[#257edc]/30 blur-3xl" />
        <div className="absolute -right-16 -top-10 size-64 rounded-full bg-[#5e4ce6]/40 blur-3xl" />

        <div className="relative flex w-full flex-col p-10 xl:p-14">
          <BrandLockup />
          <div className="mt-16 xl:mt-20">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#9cc2ff]">AI Academic Hub</p>
            <h2 className="mt-4 font-headline text-4xl font-bold leading-[1.12] tracking-tight text-white xl:text-[44px]">
              Learn smarter.
              <br />
              <span className="bg-gradient-to-r from-[#6db3ff] to-[#b7a8ff] bg-clip-text text-transparent">Remember longer.</span>
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
              Upload your material and ScholarMate turns it into notes, quizzes, and a study plan that adapts to you.
            </p>
          </div>
          <div className="mt-12 space-y-5">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#bcd6ff] ring-1 ring-white/15 backdrop-blur">
                  <feature.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{feature.title}</span>
                  <span className="mt-0.5 block max-w-sm text-[13px] leading-relaxed text-white/60">{feature.text}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-auto pt-12 text-[11px] font-medium uppercase tracking-[0.24em] text-white/40">
            ScholarMate · Study · Practice · Improve
          </p>
        </div>
      </aside>

      {/* Form side */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[440px]">
          <div className="mb-7 lg:hidden">
            <BrandLockup dark centered />
          </div>
          <div className="rounded-[26px] border border-[#dbe5f3] bg-white p-6 shadow-[0_24px_60px_-24px_rgba(13,27,62,0.28)] sm:p-8">
            {children}
          </div>
          <p className="mt-5 text-center text-xs text-slate-500">
            Protected accounts · Your records stay private to you
          </p>
        </div>
      </main>
    </div>
  );
}

/** Official-style multicolor Google "G" for the sign-in button. */
export function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.58v2.97h3.88c2.27-2.09 3.57-5.16 3.57-8.74z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-2.97c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.96H1.28v3.07A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.38-2.31V6.62H1.28a12 12 0 0 0 0 10.76l4.01-3.07z" />
      <path fill="#EA4335" d="M12 4.73c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.07C6.23 6.84 8.88 4.73 12 4.73z" />
    </svg>
  );
}
