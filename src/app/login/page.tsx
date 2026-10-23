'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { describeAuthError, getUserProfile, portalPathForRole, saveUserProfile, type UserProfile, type UserRole } from '@/lib/auth-profile';
import { RolePicker } from '@/components/RolePicker';

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
      <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/25">
        <Sparkles className="size-6" />
      </span>
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
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
      .then((found) => {
        if (cancelled) return;
        setProfile(found);
        if (found) router.replace(portalPathForRole(found.role));
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/25">
            <Sparkles className="size-5" />
          </span>
          <span className="font-headline text-2xl font-bold tracking-tight">
            Scholar<span className="text-gradient">Mate</span>
          </span>
        </Link>

        <Card className="overflow-hidden border-border/60 shadow-xl shadow-primary/5">
          <CardContent className="space-y-5 p-6 sm:p-8">
            {user && profile === null ? (
              <>
                <div className="text-center">
                  <h1 className="font-headline text-2xl font-bold tracking-tight">One last step</h1>
                  <p className="mt-1 text-sm text-muted-foreground">You are signed in as {user.email}. Tell us who you are so your records land in the right workspace.</p>
                </div>
                <div className="space-y-2">
                  <Label>I am a</Label>
                  <RolePicker value={roleChoice} onChange={setRoleChoice} />
                </div>
                {error && <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-600">{error}</p>}
                <Button className="h-12 w-full rounded-2xl text-base font-semibold" disabled={savingRole} onClick={() => void completeProfile()}>
                  {savingRole ? <><Loader2 className="mr-2 size-5 animate-spin" /> Setting up...</> : 'Continue to my workspace'}
                </Button>
              </>
            ) : (
              <>
                <div className="text-center">
                  <h1 className="font-headline text-2xl font-bold tracking-tight">Welcome back</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Log in to pick up your notes, quizzes, scores, and study plan.</p>
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

                  <Button type="submit" className="h-12 w-full rounded-2xl text-base font-semibold" disabled={busy}>
                    {busy ? <><Loader2 className="mr-2 size-5 animate-spin" /> Logging in...</> : 'Log in'}
                  </Button>
                </form>

                <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>

                <Button type="button" variant="outline" className="h-12 w-full rounded-2xl font-semibold" disabled={busy} onClick={() => void handleGoogle()}>
                  Continue with Google
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  New to ScholarMate?{' '}
                  <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
