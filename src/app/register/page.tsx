'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { describeAuthError, getUserProfile, portalPathForRole, saveUserProfile, type UserRole } from '@/lib/auth-profile';
import { RolePicker } from '@/components/RolePicker';

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

  const finishSignUp = async (uid: string, accountName: string, accountEmail: string, chosenRole: UserRole) => {
    await saveUserProfile(firestore, {
      id: uid,
      name: accountName,
      email: accountEmail,
      role: chosenRole,
      createdAt: new Date().toISOString(),
    });
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
      const existing = await getUserProfile(firestore, credential.user.uid);
      if (existing) {
        router.push(portalPathForRole(existing.role));
        return;
      }
      await finishSignUp(
        credential.user.uid,
        credential.user.displayName || credential.user.email?.split('@')[0] || 'User',
        credential.user.email || '',
        role
      );
    } catch (googleError) {
      setError(describeAuthError(googleError));
      setBusy(false);
    }
  };

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
            <div className="text-center">
              <h1 className="font-headline text-2xl font-bold tracking-tight">Create your account</h1>
              <p className="mt-1 text-sm text-muted-foreground">Your notes, quizzes, scores, and plans stay saved under your account.</p>
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

              <Button type="submit" className="h-12 w-full rounded-2xl text-base font-semibold" disabled={busy}>
                {busy ? <><Loader2 className="mr-2 size-5 animate-spin" /> Creating account...</> : `Create ${role} account`}
              </Button>
            </form>

            <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <Button type="button" variant="outline" className="h-12 w-full rounded-2xl font-semibold" disabled={busy} onClick={() => void handleGoogle()}>
              Continue with Google
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">Log in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
