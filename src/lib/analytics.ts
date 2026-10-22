import type { QuizAttempt } from './study-store';

/**
 * Local assessment analytics.
 *
 * Everything in this module is computed from quiz attempts the student has
 * already saved — knowledge-gap detection, adaptive difficulty, and the
 * post-quiz feedback summary are pure calculations over that history.
 * No AI calls are made here.
 */

export type TopicStatus = 'Weak' | 'Improving' | 'Strong';

export interface TopicStat {
  topic: string;
  attempts: number;
  avgPct: number;
  firstPct: number;
  latestPct: number;
  bestPct: number;
  status: TopicStatus;
  lastAttemptAt: string;
}

export function attemptPct(attempt: Pick<QuizAttempt, 'score' | 'total'>): number {
  return attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;
}

export function topicOf(attempt: QuizAttempt): string {
  return (attempt.topic || attempt.quizTitle || 'General').trim() || 'General';
}

/** Group attempts by topic and summarize strength per topic, weakest first. */
export function getTopicStats(attempts: QuizAttempt[]): TopicStat[] {
  const groups = new Map<string, QuizAttempt[]>();
  for (const attempt of attempts) {
    const key = topicOf(attempt);
    const list = groups.get(key);
    if (list) list.push(attempt);
    else groups.set(key, [attempt]);
  }

  const stats: TopicStat[] = [];
  for (const [topic, list] of groups) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );
    const pcts = sorted.map(attemptPct);
    const avgPct = Math.round(pcts.reduce((sum, pct) => sum + pct, 0) / pcts.length);
    stats.push({
      topic,
      attempts: sorted.length,
      avgPct,
      firstPct: pcts[0],
      latestPct: pcts[pcts.length - 1],
      bestPct: Math.max(...pcts),
      status: avgPct < 60 ? 'Weak' : avgPct < 80 ? 'Improving' : 'Strong',
      lastAttemptAt: sorted[sorted.length - 1].completedAt,
    });
  }
  return stats.sort((a, b) => a.avgPct - b.avgPct);
}

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

function levelForAverage(avgPct: number): DifficultyLevel {
  if (avgPct >= 80) return 'Hard';
  if (avgPct >= 50) return 'Medium';
  return 'Easy';
}

/**
 * Adaptive difficulty: the level follows the student's own scores.
 * A known topic uses that topic's average; otherwise the overall average.
 */
export function resolveAdaptiveDifficulty(
  attempts: QuizAttempt[],
  topic?: string | null
): { level: DifficultyLevel; reason: string } {
  if (topic) {
    const stat = getTopicStats(attempts).find(
      (item) => item.topic.toLowerCase() === topic.trim().toLowerCase()
    );
    if (stat) {
      return {
        level: levelForAverage(stat.avgPct),
        reason: `Your average on ${stat.topic} is ${stat.avgPct}% across ${stat.attempts} attempt${stat.attempts === 1 ? '' : 's'}.`,
      };
    }
  }
  if (attempts.length) {
    const avgPct = Math.round(
      attempts.reduce((sum, attempt) => sum + attemptPct(attempt), 0) / attempts.length
    );
    return {
      level: levelForAverage(avgPct),
      reason: `Based on your overall quiz average of ${avgPct}% so far.`,
    };
  }
  return {
    level: 'Medium',
    reason: 'No quiz history yet — starting at Medium. It adapts as you practice.',
  };
}

export interface MissedQuestion {
  index: number;
  questionText: string;
  correctAnswer: string;
  explanation?: string;
}

export interface FeedbackSummary {
  headline: string;
  pct: number;
  correctCount: number;
  missed: MissedQuestion[];
  nextStep: string;
}

interface SummaryQuestion {
  questionText: string;
  correctAnswer: string;
  explanation?: string;
}

/** Personal feedback summary for a finished quiz, computed from the answers themselves. */
export function buildFeedbackSummary(
  score: number,
  total: number,
  perQuestion: boolean[],
  questions: SummaryQuestion[],
  topic?: string | null
): FeedbackSummary {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const missed: MissedQuestion[] = [];
  perQuestion.forEach((correct, index) => {
    if (!correct && questions[index]) {
      missed.push({
        index,
        questionText: questions[index].questionText,
        correctAnswer: questions[index].correctAnswer,
        explanation: questions[index].explanation,
      });
    }
  });

  const headline =
    pct >= 80
      ? 'Strong work — you have a good grip on this material.'
      : pct >= 50
        ? 'Good progress — a few gaps are holding your score back.'
        : 'This topic needs attention — the gaps below are exactly where to start.';

  const nextStep = missed.length
    ? `Revise the ${missed.length} missed question${missed.length === 1 ? '' : 's'} below${topic ? `, then re-check ${topic} from your Weak Areas page` : ', then try a practice round from your Weak Areas page'}.`
    : 'No missed questions — move the difficulty up or try a new topic to keep growing.';

  return { headline, pct, correctCount: score, missed, nextStep };
}
