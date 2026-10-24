import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';

export type UserRole = 'student' | 'teacher';

/** The account record stored at userProfiles/{uid}. The `id` field must equal the uid (required by the security rules). */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export async function getUserProfile(firestore: Firestore, uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(firestore, 'userProfiles', uid));
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}

export async function saveUserProfile(firestore: Firestore, profile: UserProfile): Promise<void> {
  await setDoc(doc(firestore, 'userProfiles', profile.id), profile, { merge: true });
}

const PENDING_ROLE_KEY = 'scholarmate.pendingRole';

/**
 * The role chosen on the register page is remembered in the tab session,
 * so it survives the trip through Google sign-in — or a detour via the
 * login page — and is applied to the account the moment its profile is
 * created. Once a profile exists, the question is never asked again.
 */
export function stashPendingRole(role: UserRole) {
  try {
    window.sessionStorage.setItem(PENDING_ROLE_KEY, role);
  } catch {
    // Session storage unavailable — the in-page flows still carry the role.
  }
}

export function readPendingRole(): UserRole | null {
  try {
    const value = window.sessionStorage.getItem(PENDING_ROLE_KEY);
    return value === 'student' || value === 'teacher' ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingRole() {
  try {
    window.sessionStorage.removeItem(PENDING_ROLE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Return the signed-in user's profile, creating it first when this
 * sign-in has none. The role comes from `preferredRole` (the register
 * page's picker) or the remembered registration choice; with no role
 * signal at all it returns null and lets the caller ask — once. An
 * existing profile is returned untouched, never overwritten.
 */
export async function ensureUserProfile(
  firestore: Firestore,
  user: { uid: string; displayName?: string | null; email?: string | null },
  preferredRole?: UserRole | null
): Promise<UserProfile | null> {
  const existing = await getUserProfile(firestore, user.uid);
  if (existing) return existing;
  const role = preferredRole ?? readPendingRole();
  if (!role) return null;
  const profile: UserProfile = {
    id: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    role,
    createdAt: new Date().toISOString(),
  };
  await saveUserProfile(firestore, profile);
  clearPendingRole();
  return profile;
}

export function portalPathForRole(role: UserRole): string {
  return role === 'teacher' ? '/teacher' : '/student';
}

/** Friendly messages for the Firebase Auth errors a user can actually hit. */
export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Log in instead.';
    case 'auth/invalid-email':
      return 'That email address does not look valid.';
    case 'auth/weak-password':
      return 'Password is too weak — use at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for the app yet. Please contact the administrator.';
    case 'auth/unauthorized-domain':
      return "This website's domain is not authorized for sign-in yet. Please contact the administrator.";
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/network-request-failed':
      return 'Network problem — check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
