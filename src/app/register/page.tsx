'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { clearPendingRole, describeAuthError, ensureUserProfile, portalPathForRole, saveUserProfile, stashPendingRole, type UserRole } from '@/lib/auth-profile';
import { RolePicker } from '@/components/RolePicker';
import { AuthLayout, GoogleGlyph } from '@/components/AuthLayout';

function RegisterForm() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(searchParams.get('role') === 'teacher' ? 'teacher' : 'student');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Remember the picked role for the whole tab session, so whichever
  // sign-in path completes the account (Google popup, or finishing via
  // the login page) applies this exact choice to the profile.
  useEffect(() => {
    stashPendingRole(role);
  }, [role]);

  const finishSignUp = async (uid: string, accountName: string, accountEmail: string, chosenRole: UserRole) => {
    await saveUserProfile(firestore, {
      id: uid,
      name: accountName,
      email: accountEmail,
      role: chosenRole,
      createdAt: new Date().toISOString(),
    });
    clearPendingRole();
    router.push(portalPathForRole(chosenRole));
  };

  const handleEmailSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth || busy) return;
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await finishSignUp(credential.user.uid, name.trim(), email.trim(), role);
    } catch (signUpError) {
      setError(describeAuthError(signUpError));
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (!auth || busy) return;
    setBusy(true);
    setError('');
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      // Creates the profile with the role picked above when this Google
      // account is new; returns the saved profile untouched when it is not.
      const profile = await ensureUserProfile(firestore, credential.user, role);
      router.push(portalPathForRole(profile?.role ?? role));
    } catch (googleError) {
      setError(describeAuthError(googleError));
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Join ScholarMate</p>
          <h1 className="mt-2 font-headline text-[26px] font-bold leading-tight tracking-tight text-[#0d1b3e] dark:text-foreground">Create your account</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-muted-foreground">Your notes, quizzes, scores, and study plan stay saved under your account.</p>
        </div>

        <div className="space-y-2">
          <Label>I am registering as a</Label>
          <RolePicker value={role} onChange={setRole} />
        </div>

        <form className="space-y-4" onSubmit={handleEmailSignUp}>
          <div className="space-y-1.5">
            <Label htmlFor="register-name">Full name</Label>
            <Input id="register-name" className="h-11 rounded-2xl" placeholder="e.g. Muhammad Zohaib" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="register-email">Email</Label>
            <Input id="register-email" type="email" className="h-11 rounded-2xl" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="register-password">Password</Label>
            <Input id="register-password" type="password" className="h-11 rounded-2xl" placeholder="At least 6 characters" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
          </div>

          {error && <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-600">{error}</p>}

          <Button type="submit" className="h-12 w-full rounded-2xl bg-gradient-to-r from-[#216ec0] to-[#5e4ce6] text-base font-semibold shadow-lg shadow-[#5e4ce6]/25 transition-opacity hover:opacity-95" disabled={busy}>
            {busy ? <><Loader2 className="mr-2 size-5 animate-spin" /> Creating account...</> : `Create ${role} account`}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-muted-foreground">
          <span className="h-px flex-1 bg-slate-200 dark:bg-border" /> or <span className="h-px flex-1 bg-slate-200 dark:bg-border" />
        </div>

        <Button type="button" variant="outline" className="h-12 w-full rounded-2xl border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 dark:border-border dark:text-foreground dark:hover:bg-secondary" disabled={busy} onClick={() => void handleGoogle()}>
          <GoogleGlyph className="mr-2.5 size-5" /> Continue with Google
        </Button>

        <p className="text-center text-sm text-slate-500 dark:text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">Log in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
