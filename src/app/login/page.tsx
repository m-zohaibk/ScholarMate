'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { clearPendingRole, describeAuthError, ensureUserProfile, getUserProfile, portalPathForRole, saveUserProfile, type UserProfile, type UserRole } from '@/lib/auth-profile';
import { RolePicker } from '@/components/RolePicker';
import { AuthLayout, BrandLockup, GoogleGlyph } from '@/components/AuthLayout';

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#eef3fa] px-4 dark:bg-background">
      <BrandLockup dark centered />
      <p className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {label}
      </p>
    </div>
  );
}

export default function LoginPage() {
  const { auth, firestore, user, isUserLoading } = useFirebase();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // undefined = still checking, null = signed in but no profile yet
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [roleChoice, setRoleChoice] = useState<UserRole>('student');
  const [savingRole, setSavingRole] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setProfile(undefined);
      return;
    }
    let cancelled = false;
    getUserProfile(firestore, user.uid)
      .then(async (found) => {
        if (cancelled) return;
        if (found) {
          setProfile(found);
          router.replace(portalPathForRole(found.role));
          return;
        }
        // Signed in but no profile yet. If a role was chosen at
        // registration, apply it automatically — the question is only
        // asked when there is genuinely no earlier choice to remember.
        const healed = await ensureUserProfile(firestore, user).catch(() => null);
        if (cancelled) return;
        if (healed) {
          setProfile(healed);
          router.replace(portalPathForRole(healed.role));
          return;
        }
        setProfile(null);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [firestore, isUserLoading, router, user]);

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth || busy) return;
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // The effect above loads the profile and redirects.
    } catch (loginError) {
      setError(describeAuthError(loginError));
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (!auth || busy) return;
    setBusy(true);
    setError('');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (googleError) {
      setError(describeAuthError(googleError));
      setBusy(false);
    }
  };

  const completeProfile = async () => {
    if (!user || savingRole) return;
    setSavingRole(true);
    try {
      const profileToSave: UserProfile = {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        role: roleChoice,
        createdAt: new Date().toISOString(),
      };
      await saveUserProfile(firestore, profileToSave);
      clearPendingRole();
      router.replace(portalPathForRole(roleChoice));
    } catch {
      setError('Your account could not be set up. Please try again.');
      setSavingRole(false);
    }
  };

  if ((isUserLoading && !slow) || (user && profile === undefined)) {
    return <LoadingScreen label="Checking your account..." />;
  }
  if (user && profile) return <LoadingScreen label="Opening your workspace..." />;

  return (
    <AuthLayout>
      {user && profile === null ? (
        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Almost there</p>
            <h1 className="mt-2 font-headline text-[26px] font-bold leading-tight tracking-tight text-[#0d1b3e] dark:text-foreground">One last step</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-muted-foreground">You are signed in as {user.email}. Tell us who you are so your records land in the right workspace.</p>
          </div>
          <div className="space-y-2">
            <Label>I am a</Label>
            <RolePicker value={roleChoice} onChange={setRoleChoice} />
          </div>
          {error && <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-600">{error}</p>}
          <Button className="h-12 w-full rounded-2xl bg-gradient-to-r from-[#216ec0] to-[#5e4ce6] text-base font-semibold shadow-lg shadow-[#5e4ce6]/25 transition-opacity hover:opacity-95" disabled={savingRole} onClick={() => void completeProfile()}>
            {savingRole ? <><Loader2 className="mr-2 size-5 animate-spin" /> Setting up...</> : 'Continue to my workspace'}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Welcome back</p>
            <h1 className="mt-2 font-headline text-[26px] font-bold leading-tight tracking-tight text-[#0d1b3e] dark:text-foreground">Log in to ScholarMate</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-muted-foreground">Pick up your notes, quizzes, scores, and study plan where you left off.</p>
          </div>

          <form className="space-y-4" onSubmit={handleEmailLogin}>
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" className="h-11 rounded-2xl" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input id="login-password" type="password" className="h-11 rounded-2xl" placeholder="Your password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </div>

            {error && <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-600">{error}</p>}

            <Button type="submit" className="h-12 w-full rounded-2xl bg-gradient-to-r from-[#216ec0] to-[#5e4ce6] text-base font-semibold shadow-lg shadow-[#5e4ce6]/25 transition-opacity hover:opacity-95" disabled={busy}>
              {busy ? <><Loader2 className="mr-2 size-5 animate-spin" /> Logging in...</> : 'Log in'}
            </Button>
          </form>

          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-muted-foreground">
            <span className="h-px flex-1 bg-slate-200 dark:bg-border" /> or <span className="h-px flex-1 bg-slate-200 dark:bg-border" />
          </div>

          <Button type="button" variant="outline" className="h-12 w-full rounded-2xl border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 dark:border-border dark:text-foreground dark:hover:bg-secondary" disabled={busy} onClick={() => void handleGoogle()}>
            <GoogleGlyph className="mr-2.5 size-5" /> Continue with Google
          </Button>

          <p className="text-center text-sm text-slate-500 dark:text-muted-foreground">
            New to ScholarMate?{' '}
            <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
