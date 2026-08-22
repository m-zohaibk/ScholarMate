import { collection, doc, getDocs, query, setDoc, where, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { QuizAttempt, StoredNote, StoredQuiz, StudyTask } from './study-store';

function requireUser(user: User | null) {
  return user?.uid || null;
}

async function readUserCollection<T>(firestore: Firestore, user: User | null, name: string) {
  const uid = requireUser(user);
  if (!uid) return [] as T[];
  const snapshot = await getDocs(collection(firestore, 'userProfiles', uid, name));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
}

async function writeUserDocument(firestore: Firestore, user: User | null, name: string, id: string, data: Record<string, unknown>, ownerField: string) {
  const uid = requireUser(user);
  if (!uid) return;
  await setDoc(doc(firestore, 'userProfiles', uid, name, id), { ...data, [ownerField]: uid }, { merge: true });
}

export async function loadNotes(firestore: Firestore, user: User | null) {
  return readUserCollection<StoredNote>(firestore, user, 'notes');
}

export async function saveNoteToFirestore(firestore: Firestore, user: User | null, note: StoredNote) {
  return writeUserDocument(firestore, user, 'notes', note.id, note, 'studentId');
}

export async function loadTasks(firestore: Firestore, user: User | null) {
  return readUserCollection<StudyTask>(firestore, user, 'studySchedules');
}

export async function saveTaskToFirestore(firestore: Firestore, user: User | null, task: StudyTask) {
  return writeUserDocument(firestore, user, 'studySchedules', task.id, task, 'studentId');
}

export async function loadPersonalQuizzes(firestore: Firestore, user: User | null) {
  return readUserCollection<StoredQuiz>(firestore, user, 'personalQuizzes');
}

export async function saveQuizToFirestore(firestore: Firestore, user: User | null, quiz: StoredQuiz) {
  return writeUserDocument(firestore, user, 'personalQuizzes', quiz.id, quiz, 'creatorId');
}

export async function loadAttempts(firestore: Firestore, user: User | null) {
  return readUserCollection<QuizAttempt>(firestore, user, 'quizAttempts');
}

export async function saveAttemptToFirestore(firestore: Firestore, user: User | null, attempt: QuizAttempt) {
  return writeUserDocument(firestore, user, 'quizAttempts', attempt.id, attempt, 'studentId');
}

export async function loadPublishedQuizzes(firestore: Firestore, user: User | null) {
  if (!requireUser(user)) return [] as StoredQuiz[];
  const snapshot = await getDocs(query(collection(firestore, 'publishedQuizzes'), where('isPublic', '==', true)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as StoredQuiz).filter((quiz) => quiz.published);
}

export async function savePublishedQuizToFirestore(firestore: Firestore, user: User | null, quiz: StoredQuiz) {
  const uid = requireUser(user);
  if (!uid) return;
  await setDoc(doc(firestore, 'publishedQuizzes', quiz.id), { ...quiz, creatorId: uid, isPublic: quiz.published, sharedWithStudents: {} }, { merge: true });
}
