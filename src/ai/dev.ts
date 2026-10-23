import { config } from 'dotenv';
config();

import '@/ai/flows/student-structured-notes.ts';
import '@/ai/flows/teacher-quiz-generation.ts';
import '@/ai/flows/student-quiz-generation-flow.ts';
import '@/ai/flows/explain-simply.ts';
import '@/ai/flows/study-plan-generation.ts';
import '@/ai/flows/evaluate-answer.ts';