'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Visible, honest progress for AI generation: an animated bar, a live elapsed
 * timer, and a plain note that a first generation can take a little while —
 * so a long wait reads as "working", never as "stuck" or "broken".
 */
export function GenerationProgress({ title, hint }: { title: string; hint?: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="animate-in fade-in rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-5 animate-pulse" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {hint || 'Working on it now — larger documents take longer. Please keep this page open.'}
            <span className="font-medium text-foreground"> {seconds}s</span>
          </p>
        </div>
      </div>
      <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-primary/10">
        <div className="generation-progress-bar h-full w-1/3 rounded-full bg-gradient-to-r from-primary to-accent" />
      </div>
      <style>{`
        @keyframes generation-slide {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(320%); }
        }
        .generation-progress-bar { animation: generation-slide 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
