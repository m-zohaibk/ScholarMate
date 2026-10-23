'use server';
/**
 * @fileOverview Generates a day-by-day study plan from subjects, exam dates,
 * the student's available hours, and their measured topic strengths.
 * The plan is saved as ordinary study tasks by the client.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PlanTopicSchema = z.object({
  title: z.string().describe('A topic or chapter within the subject.'),
  strengthPct: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("The student's measured average score on this topic from past quizzes, when known. Lower means weaker."),
  status: z.string().optional().describe('Weak, Improving, or Strong, when known.'),
});

const PlanSubjectSchema = z.object({
  name: z.string().describe('The subject name.'),
  examDate: z.string().describe('The exam date for this subject, as YYYY-MM-DD.'),
  topics: z.array(PlanTopicSchema).describe('Topics to cover for this subject; may be empty.'),
});

const StudyPlanInputSchema = z.object({
  startDate: z.string().describe('The first day of the plan, as YYYY-MM-DD.'),
  hoursPerDay: z.number().min(0.5).max(12).describe('Maximum study hours available per day.'),
  dayStartTime: z.string().describe('Preferred time of day to start studying, as HH:MM (24h).'),
  subjects: z.array(PlanSubjectSchema).min(1).describe('Subjects to plan for, each with its exam date.'),
  busyMinutesByDate: z
    .record(z.string(), z.number())
    .optional()
    .describe('Minutes already committed to fixed tasks per date (YYYY-MM-DD). Subtract these from that day\'s capacity.'),
  note: z.string().optional().describe('Extra context, e.g. that this is a rebalance with updated scores.'),
});
export type StudyPlanInput = z.infer<typeof StudyPlanInputSchema>;

const StudyPlanSessionSchema = z.object({
  date: z.string().describe('Session date, as YYYY-MM-DD.'),
  time: z.string().describe('Session start time, as HH:MM (24h).'),
  durationMinutes: z.number().int().min(15).max(120).describe('Session length in minutes, between 30 and 90 for most sessions.'),
  title: z.string().describe('A short, specific session title, e.g. "Learn: Thermodynamics basics" or "Practice quiz: Entropy".'),
  subject: z.string().describe('The subject this session belongs to.'),
  topic: z.string().optional().describe('The topic this session covers, when applicable.'),
  type: z.enum(['Learn', 'Practice', 'Revision']).describe('Learn = first study of the topic, Practice = questions/quiz on it, Revision = recap close to the exam.'),
});

const StudyPlanOutputSchema = z.object({
  planTitle: z.string().describe('A short title for the whole plan.'),
  summary: z.string().describe('Two or three sentences describing how the plan is organized and what it prioritizes.'),
  sessions: z.array(StudyPlanSessionSchema).describe('All planned sessions, in date order.'),
});
export type StudyPlanOutput = z.infer<typeof StudyPlanOutputSchema>;

export async function generateStudyPlan(input: StudyPlanInput): Promise<StudyPlanOutput> {
  return studyPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'studyPlanPrompt',
  input: { schema: StudyPlanInputSchema },
  output: { schema: StudyPlanOutputSchema },
  prompt: `You are an expert study planner. Build a realistic day-by-day study plan.

Plan window: from {{{startDate}}} until each subject's exam date.
Available time: {{{hoursPerDay}}} hours per day, starting around {{{dayStartTime}}}.
{{#if note}}Context: {{{note}}}{{/if}}

Subjects (JSON):
{{{json subjects}}}

{{#if busyMinutesByDate}}
Minutes already taken by fixed tasks per date (JSON, subtract from that day's capacity):
{{{json busyMinutesByDate}}}
{{/if}}

Planning rules:
1. Work BACKWARDS from each exam date: Learn sessions early, Practice sessions in the middle stretch, Revision sessions in the final days before that subject's exam. Never schedule a subject after its exam date.
2. Weak topics come first and get more time: a topic with a low strengthPct (or status Weak) gets more sessions and earlier Learn slots than a Strong topic. Strong topics mainly need Revision.
3. Space the repetition: after a topic's Learn session, schedule its Practice 1-3 days later and a Revision about a week later (compress if the exam is near).
4. Respect the daily capacity strictly: the total session minutes on any date must not exceed the available hours minus that date's busy minutes. Prefer fewer, longer sessions (30-90 minutes) over many tiny ones.
5. Start the day at the preferred start time; leave at least 10-15 minutes between sessions; do not start sessions before 07:00 or after 21:00.
6. If a subject has no topic list, plan sensible broad sessions for it (e.g. "Learn: <subject> fundamentals", "Practice: <subject> questions").
7. Titles must be specific and actionable, naming the topic when there is one.
8. Return sessions in date order.

Respond strictly as one valid JSON object matching the output schema. Do not wrap the response in Markdown fences or add commentary.`,
});

const studyPlanFlow = ai.defineFlow(
  {
    name: 'studyPlanFlow',
    inputSchema: StudyPlanInputSchema,
    outputSchema: StudyPlanOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
