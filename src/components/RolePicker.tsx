'use client';

import { BookOpen, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/auth-profile';

const ROLES: Array<{ value: UserRole; title: string; blurb: string; icon: typeof GraduationCap }> = [
  { value: 'student', title: 'Student', blurb: 'Learn, practice, and track your weak areas', icon: GraduationCap },
  { value: 'teacher', title: 'Teacher', blurb: 'Create quizzes and view class insights', icon: BookOpen },
];

export function RolePicker({ value, onChange }: { value: UserRole; onChange: (role: UserRole) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Register as">
      {ROLES.map((role) => {
        const selected = value === role.value;
        return (
          <button
            key={role.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(role.value)}
            className={cn(
              'rounded-2xl border-2 p-4 text-left transition-all',
              selected
                ? 'border-primary bg-primary/[0.06] shadow-sm'
                : 'border-border/70 bg-card/60 hover:border-primary/40'
            )}
          >
            <span className={cn('grid size-10 place-items-center rounded-xl', selected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
              <role.icon className="size-5" />
            </span>
            <span className="mt-2.5 block font-headline text-[15px] font-bold">{role.title}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{role.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}
