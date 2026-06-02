# Project Proposal: ScholarMate AI

## 1. Project Information
**Project Title:** ScholarMate AI: Academic Excellence with Intelligence  
**Program:** BS Computer Science (Morning/Evening)  
**Students:** [Your Name] (Reg No: [Your ID])  
**Supervisor:** [Supervisor’s Name]  
**Date:** October 26, 2023

---

## 2. Abstract
ScholarMate AI is an intelligent educational platform designed to bridge the gap between static study materials and active learning. The problem addressed is the significant time students and teachers spend manually organizing notes and creating assessments. The proposed solution leverages **Gemini 2.5 Flash** via **Genkit** to perform high-fidelity OCR on handwritten notes and complex PDFs, automatically transforming them into structured hierarchical notes and interactive quizzes. Key technologies include **Next.js 15**, **Firebase (Auth & Firestore)**, and **ShadCN UI**. The expected impact is a 40% reduction in study-prep time and improved retention through immediate feedback loops.

---

## 3. Introduction / Background
In the modern academic landscape, students are overwhelmed with information in diverse formats (images, handwritten notebooks, digital PDFs). Traditional study methods are often passive. ScholarMate AI introduces an "AI Study Partner" that actively processes these materials.
- **Significance:** Automates the most tedious parts of learning (summarization and test creation).
- **SDG Alignment:** Addresses **Goal 4: Quality Education** by providing accessible, high-quality personalized tutoring tools that adapt to individual study materials.

---

## 4. Problem Statement & Proposed Solution

| Problem | Proposed Solution |
| :--- | :--- |
| **P1: Passive Learning.** Students read but don't test themselves, leading to poor long-term retention. | **S1: Interactive Quizzing.** The system generates tailored quizzes from user content with immediate "True/False" feedback and AI explanations. |
| **P2: Unstructured Data.** Handwritten notes and complex diagrams are difficult to search or summarize. | **S2: Vision AI OCR.** Uses Gemini's multimodal capabilities to transcribe handwriting and interpret diagrams into clean, structured Markdown notes. |
| **P3: Teacher Overload.** Creating unique, syllabus-aligned assessments for every topic is time-consuming. | **S3: Assessment Engine.** A dedicated teacher dashboard that generates multi-format exams (MCQ, Conceptual) from a simple syllabus list. |

---

## 5. Project Objectives
- **Main Goal:** To develop a fully functional web-based AI educational platform that automates note synthesis and quiz generation.
- **Specific Objectives:**
  1. **Design** a responsive, glassmorphism-inspired UI using Tailwind CSS and ShadCN.
  2. **Implement** real-time OCR for handwriting detection using Google Vision (via Genkit).
  3. **Develop** an interactive quiz module with immediate feedback and performance tracking.
  4. **Evaluate** the system's accuracy in transcribing diverse academic fonts and layouts.

---

## 6. Scope of the Project
- **Included:** PDF/Image processing, Handwritten note OCR, Quiz generation (MCQ/Short Answer), Personalized study scheduling.
- **Excluded:** Live video tutoring, peer-to-peer social networking, native mobile application (initially web-only).
- **Users:** K-12 and Higher-Ed Students, Academic Teachers.

---

## 7. Requirement Gathering and Analysis

| Category | Details |
| :--- | :--- |
| **Data Collection** | Literature review of active recall techniques and user interviews with 10 college students. |
| **Functional** | User Authentication (Firebase), File Upload (PDF/JPG), AI Note Generation, Interactive Quiz Interface. |
| **Non-Functional** | Latency < 5s for AI responses, Mobile-responsiveness, Data encryption at rest (Firestore). |
| **Users** | **Students:** Upload materials, take quizzes. **Teachers:** Create assessments, export keys. |

---

## 8. Use Case Diagram
- **Actor: Student** -> (Upload Material) -> (Generate Notes) -> (Take Quiz) -> (View Results).
- **Actor: Teacher** -> (Input Syllabus) -> (Generate Exam) -> (Export Assessment).
- **System:** -> (Process Image/PDF) -> (Compute AI Response) -> (Store Data in Firestore).

---

## 9. Feasibility Study
- **Technical:** High. Tools like Genkit and Firebase provide robust, scalable infrastructure.
- **Economic:** Moderate. Uses pay-as-you-go cloud models; highly cost-effective for MVP.
- **Operational:** High. Fits directly into the study workflow by digitizing existing physical notes.

---

## 10. Methodology / System Design
- **Methodology:** **Agile/Scrum.** Weekly sprints for feature integration and testing.
- **Architecture:** **Client-Side Firebase.** Next.js App Router for UI, Firebase for Auth/DB, and Server Actions for Genkit AI flows.
- **Data Flow:** User -> File Upload -> Genkit (Gemini) -> Firestore -> UI Dashboard.

---

## 11. Tools and Technologies
- **Programming Language:** TypeScript
- **Framework:** Next.js 15 (App Router)
- **Database:** Firebase Firestore (NoSQL)
- **AI Framework:** Genkit (Google AI Plugin)
- **UI Tools:** Tailwind CSS, ShadCN UI, Lucide Icons
- **Hosting:** Firebase App Hosting

---

## 12. Expected Deliverables
- **Software Prototype:** Fully functional web app at `scholarmate.web.app`.
- **Database:** Structured Firestore schema for User Profiles, Documents, and Quizzes.
- **Documentation:** User manual, Technical architecture guide, and Final Thesis Report.
- **Presentation:** 15-minute live demo of handwriting-to-quiz conversion.

---

## 13. Project Timeline
1. **Requirement Analysis:** Week 1-2 (Define AI Prompts and DB Schemas)
2. **System Design:** Week 3 (UI Mockups in Figma, Layout structuring)
3. **Implementation:** Week 4-8 (AI Flows, Firebase Integration, Quiz Logic)
4. **Testing:** Week 9 (OCR accuracy testing, cross-browser checks)
5. **Documentation:** Week 10 (Final Report and Presentation)

---

## 14. References
- [1] Google Genkit Documentation: https://firebase.google.com/docs/genkit
- [2] Firebase Security Rules Patterns: https://firebase.google.com/docs/rules
- [3] Next.js 15 App Router Best Practices.
- [4] Dunlosky et al. (2013). Improving Students’ Learning with Effective Learning Techniques.
