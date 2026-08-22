# Smart Academic Assistant System Using Artificial Intelligence for Automated Assessment and Student Learning Enhancement

This is a NextJS platform built with Firebase and Genkit, designed for AI-powered academic assistance.

## Quick Links
- **Project Proposal**: See `docs/project-proposal.md` for the full academic proposal including abstract, methodology, and SDG alignment.
- **Student Dashboard**: `/student`
- **Teacher Dashboard**: `/teacher`

## Features
- **Vision OCR**: High-precision recognition of handwritten notes and complex PDF diagrams.
- **Active Recall**: Generates quizzes with immediate color-coded feedback and AI explanations.
- **Structured Notes**: Converts long documents into hierarchical study summaries using Gemini 2.5 Flash.
- **Automated Assessment**: Teacher-led syllabus analysis and exam generation.

## Tech Stack
- **Frontend**: Next.js 15, Tailwind CSS, ShadCN UI.
- **Backend**: Firebase (Auth, Firestore, App Hosting).
- **AI**: Genkit with Gemini 2.5 Flash.

## Google AI Configuration

The AI routes read the Google AI Studio key on the server from `GOOGLE_GENAI_API_KEY`. The repository includes only the safe placeholder file `.env.example`; the real `.env.local` file remains ignored and is never committed.

For local development, copy `.env.example` to `.env.local` and replace the placeholder value:

```bash
cp .env.example .env.local
```

Then set `GOOGLE_GENAI_API_KEY` in `.env.local` to a valid Google AI Studio API key and restart the development server. Student Notes, Student Quiz, scanned-PDF OCR, and Teacher Quiz generation use this server-configured key automatically; the website does not ask for a key during normal use. Never place a real key in GitHub, source code, browser storage, Firebase, or chat messages.
