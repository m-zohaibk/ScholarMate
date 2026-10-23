'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { getUserProfile, portalPathForRole, type UserProfile, type UserRole } from '@/lib/auth-profile';

/**
 * Guards a portal: only a signed-in user with a matching account role gets
 * in. Everyone else is sent to login, or to their own portal.
 */
export function AuthGate({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { firestore, user, isUserLoading } = useFirebase();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  // Safety net: if the auth check itself ever hangs, fall back to login.
  useEffect(() => {
    if (slow && isUserLoading && !user) router.replace('/login');
  }, [isUserLoading, router, slow, user]);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    getUserProfile(firestore, user.uid)
      .then((found) => {
        if (cancelled) return;
        setProfile(found);
        if (!found) router.replace('/login');
        else if (found.role !== role) router.replace(portalPathForRole(found.role));
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(null);
          router.replace('/login');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [firestore, isUserLoading, role, router, user]);

  if (isUserLoading || !user || profile === undefined || !profile || profile.role !== role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/25">
          <Sparkles className="size-6" />
        </span>
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your workspace...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
