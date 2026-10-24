'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';
}

/**
 * Dark/light switch. The choice is stored on the device and re-applied
 * before first paint by the script in the root layout, so the app never
 * flashes the wrong theme. First visit follows the device's own setting.
 */
export function ThemeToggle({
  variant = 'auto',
  withLabel = false,
  className,
}: {
  variant?: 'auto' | 'onDark';
  withLabel?: boolean;
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const toggle = () => {
    const next: Theme = (theme ?? currentTheme()) === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      window.localStorage.setItem('scholarmate.theme', next);
    } catch {
      // Storage unavailable — the switch still applies for this session.
    }
  };

  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const targetLabel = isDark ? 'Light mode' : 'Dark mode';

  if (withLabel) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={`Switch to ${targetLabel.toLowerCase()}`}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-medium transition-colors',
          variant === 'onDark'
            ? 'text-white/70 hover:bg-white/10 hover:text-white'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          className
        )}
      >
        <Icon className={cn('size-5 shrink-0', variant === 'onDark' ? 'text-white/60' : 'text-muted-foreground')} />
        {targetLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${targetLabel.toLowerCase()}`}
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-xl border border-border/70 bg-card text-foreground shadow-soft transition-colors hover:bg-secondary',
        className
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
