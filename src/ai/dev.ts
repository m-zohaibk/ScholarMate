import { config } from 'dotenv';
config();

import '@/ai/flows/student-structured-notes.ts';
import '@/ai/flows/teacher-quiz-generation.ts';
import '@/ai/flows/student-quiz-generation-flow.ts';