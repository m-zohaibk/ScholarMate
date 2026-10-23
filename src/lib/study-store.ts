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

const PLAN_SETUP_KEY = 'scholarmate.planSetup';

export function getPlanSetup(): StudyPlanSetup | null {
  if (!canUseStorage()) return null;
  try {
    const value = window.localStorage.getItem(PLAN_SETUP_KEY);
    return value ? (JSON.parse(value) as StudyPlanSetup) : null;
  } catch {
    return null;
  }
}

export function savePlanSetup(setup: StudyPlanSetup | null) {
  if (!canUseStorage()) return;
  if (setup) window.localStorage.setItem(PLAN_SETUP_KEY, JSON.stringify(setup));
  else window.localStorage.removeItem(PLAN_SETUP_KEY);
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

function read<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('scholarmate:changed', { detail: key }));
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
  const tasks = read<StudyTask[] | null>(KEYS.tasks, null);
  if (tasks) return tasks;
  const today = dateKey(new Date());
  const initial: StudyTask[] = [
    { id: makeId('task'), date: today, time: '09:00', title: 'Calculus Review', duration: '1h 30m', completed: true, category: 'Math' },
    { id: makeId('task'), date: today, time: '11:00', title: 'Biology Quiz Session', duration: '45m', completed: false, category: 'Science' },
    { id: makeId('task'), date: today, time: '14:00', title: 'Literature Notes Prep', duration: '2h', completed: false, category: 'Arts' },
  ];
  write(KEYS.tasks, initial);
  return initial;
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
