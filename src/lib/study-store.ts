export type StoredNote = {
  id: string;
  title: string;
  summary: string;
  sections: Array<{
    heading: string;
    subsections: Array<{ subheading: string; points: string[] }>;
  }>;
  sourceName: string;
  detailLevel: 'summary' | 'detailed';
  createdAt: string;
};

export type StoredQuiz = {
  id: string;
  title: string;
  description?: string;
  questions: Array<{
    questionText: string;
    type: string;
    options?: string[];
    correctAnswer: string;
    explanation?: string;
  }>;
  source: 'teacher' | 'student';
  creator: string;
  published: boolean;
  createdAt: string;
  /** Topic/material this quiz belongs to — used by Weak Areas and adaptive difficulty. */
  topic?: string;
};

export type QuizAttempt = {
  id: string;
  quizId: string;
  quizTitle: string;
  score: number;
  total: number;
  completedAt: string;
  /** Topic the attempt belongs to (defaults to the quiz title when absent). */
  topic?: string;
  /** Per-question correctness, in question order — powers the feedback summary. */
  perQuestion?: boolean[];
};

export type SourceTopic = {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
};

/**
 * A study source kept in the student's library: the document's extracted
 * text plus its chapter/topic map, so it never has to be uploaded twice.
 */
export type StoredSource = {
  id: string;
  name: string;
  kind: 'pdf' | 'docx' | 'pptx';
  totalPages: number;
  topics: SourceTopic[];
  topicSource: 'outline' | 'whole';
  pageTexts: string[];
  fullText: string;
};

export type StudyTask = {
  id: string;
  date: string;
  time: string;
  title: string;
  duration: string;
  category: string;
  completed: boolean;
  /** Set when the task was created by the AI study planner (enables clean rebalancing). */
  planId?: string;
};

/** The student's planner setup: subjects, exam dates, and daily availability. */
export type StudyPlanSetup = {
  subjects: Array<{ name: string; examDate: string; topics: string[] }>;
  hoursPerDay: number;
  dayStartTime: string;
  planTitle?: string;
  planSummary?: string;
  generatedAt?: string;
};

/**
 * Per-account data separation.
 *
 * Every record this module stores (notes, quizzes, attempts, tasks, sources
 * and the planner setup) belongs to exactly one signed-in account. The
 * Firebase provider calls setActiveAccount() whenever the signed-in user
 * changes; storage keys are then suffixed with that account's uid, so one
 * student never sees another student's data on a shared device. While
 * nobody is signed in, reads return empty results and writes are dropped.
 */
let activeUid: string | null = null;
let accountSeen = false;

export function setActiveAccount(uid: string | null) {
  const changed = !accountSeen || uid !== activeUid;
  accountSeen = true;
  activeUid = uid;
  if (!changed || typeof window === 'undefined') return;
  // A one-shot page handoff belongs to whoever was signed in when it was set.
  try {
    window.sessionStorage.removeItem(SEED_KEY);
  } catch {
    // Session storage unavailable — nothing to clear.
  }
  if (uid) claimLegacyData(uid);
}

function scopedKey(base: string): string | null {
  return activeUid ? `${base}:${activeUid}` : null;
}

const PLAN_SETUP_KEY = 'scholarmate.planSetup';

export function getPlanSetup(): StudyPlanSetup | null {
  return read<StudyPlanSetup | null>(PLAN_SETUP_KEY, null);
}

export function savePlanSetup(setup: StudyPlanSetup | null) {
  if (!canUseStorage()) return;
  const key = scopedKey(PLAN_SETUP_KEY);
  if (!key) return;
  if (setup) window.localStorage.setItem(key, JSON.stringify(setup));
  else window.localStorage.removeItem(key);
}

const KEYS = {
  notes: 'scholarmate.notes',
  quizzes: 'scholarmate.quizzes',
  attempts: 'scholarmate.attempts',
  tasks: 'scholarmate.tasks',
  sources: 'scholarmate.sources',
} as const;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * One-time upgrade for data saved before accounts existed: the first
 * account to sign in on a device adopts the old unscoped records as its
 * own, and the shared copies are removed so no later account can see them.
 */
function claimLegacyData(uid: string) {
  if (!canUseStorage()) return;
  for (const base of [...Object.values(KEYS), PLAN_SETUP_KEY]) {
    try {
      const legacy = window.localStorage.getItem(base);
      if (legacy === null) continue;
      const scoped = `${base}:${uid}`;
      if (window.localStorage.getItem(scoped) === null) {
        window.localStorage.setItem(scoped, legacy);
      }
      window.localStorage.removeItem(base);
    } catch {
      // Best effort — a failed claim must never block sign-in.
    }
  }
}

function read<T>(base: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  const key = scopedKey(base);
  if (!key) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(base: string, value: T) {
  if (!canUseStorage()) return;
  const key = scopedKey(base);
  if (!key) return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('scholarmate:changed', { detail: base }));
}

export function makeId(prefix: string) {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function getNotes() {
  return read<StoredNote[]>(KEYS.notes, []);
}

export function saveNote(note: StoredNote) {
  write(KEYS.notes, [note, ...getNotes().filter((item) => item.id !== note.id)]);
}

export function getQuizzes() {
  return read<StoredQuiz[]>(KEYS.quizzes, []);
}

export function saveQuiz(quiz: StoredQuiz) {
  write(KEYS.quizzes, [quiz, ...getQuizzes().filter((item) => item.id !== quiz.id)]);
}

export function getSources() {
  return read<StoredSource[]>(KEYS.sources, []);
}

export function saveSource(source: StoredSource) {
  write(KEYS.sources, [source, ...getSources().filter((item) => item.id !== source.id && item.name !== source.name)]);
}

export function removeSource(id: string) {
  write(KEYS.sources, getSources().filter((item) => item.id !== id));
}

export function getAttempts() {
  return read<QuizAttempt[]>(KEYS.attempts, []);
}

export function saveAttempt(attempt: QuizAttempt) {
  write(KEYS.attempts, [attempt, ...getAttempts().filter((item) => item.id !== attempt.id)]);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTasks() {
  // A new account starts with an empty schedule — no sample tasks, so no
  // one inherits a streak or study time they never earned.
  return read<StudyTask[]>(KEYS.tasks, []);
}

export function saveTasks(tasks: StudyTask[]) {
  write(KEYS.tasks, tasks);
}

export function formatDateKey(date: Date) {
  return dateKey(date);
}

export function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}

export const storageKeys = KEYS;

/**
 * One-shot handoff between pages (e.g. Weak Areas → Quiz, Notes → Quiz).
 * Stored in sessionStorage and consumed exactly once by the target page.
 */
export type StudySeed = {
  target: 'quiz' | 'notes';
  label: string;
  /** Ready-to-use study material text, when the target page should not re-read a file. */
  text?: string;
  /** Library source to preselect, when the material lives in the source library. */
  sourceId?: string;
  /** Topic title to preselect inside that source. */
  topicTitle?: string;
  /** Topic the generated quiz/notes belong to (drives Weak Areas + adaptive difficulty). */
  topic?: string;
};

const SEED_KEY = 'scholarmate.seed';

export function setStudySeed(seed: StudySeed) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SEED_KEY, JSON.stringify(seed));
  } catch {
    // Session storage unavailable — the handoff is best-effort.
  }
}

export function takeStudySeed(target: StudySeed['target']): StudySeed | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SEED_KEY);
    if (!raw) return null;
    const seed = JSON.parse(raw) as StudySeed;
    if (seed.target !== target) return null;
    window.sessionStorage.removeItem(SEED_KEY);
    return seed;
  } catch {
    return null;
  }
}
