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
};

export type QuizAttempt = {
  id: string;
  quizId: string;
  quizTitle: string;
  score: number;
  total: number;
  completedAt: string;
};

export type StudyTask = {
  id: string;
  date: string;
  time: string;
  title: string;
  duration: string;
  category: string;
  completed: boolean;
};

const KEYS = {
  notes: 'scholarmate.notes',
  quizzes: 'scholarmate.quizzes',
  attempts: 'scholarmate.attempts',
  tasks: 'scholarmate.tasks',
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
