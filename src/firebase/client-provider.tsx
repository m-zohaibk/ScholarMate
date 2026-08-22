'use client';

import React, { useEffect, useMemo, type ReactNode } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    if (firebaseServices.auth.currentUser) return;
    signInAnonymously(firebaseServices.auth).catch((error: unknown) => {
      console.warn('[Firebase] Anonymous sign-in unavailable; using local persistence.', error);
    });
  }, [firebaseServices.auth]);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}