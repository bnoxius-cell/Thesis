# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Confirmed by the owner on 2026-10-12: students in the IT programs of Our Lady of Fatima University (OLFU), Philippines. They juggle classes, lab work, group projects and exams, mostly on their phones, often between classes or late at night. The job: see what's on today, know whether the week is manageable, and get help spreading the work before it piles up.

## Product Purpose
StressCare is a thesis project: "A Web-Based Stress Management Application for College Students." It turns a student's timetable, deadlines and short validated check-ins (PSS-10 monthly, WHO-5 every two weeks) into a weekly workload reading and a plan. Success: a student opens it, understands their week in one glance, and acts on one concrete suggestion (move a task, sleep earlier, start the smallest task).

## Positioning
The workload score is computed from the student's own timetable (class hours, Philippine holidays, exams) and tasks, not just self-report, and the check-ins feed that same plan. When the plan doesn't fit, the app proposes specific due-date moves the student can apply or undo.

## Operating Context
- Signed-in web app, installable as a PWA, with push notifications.
- Pages: Today, Schedule (week, tasks, days off), Study (AI reviewers from PDFs, Learning Mode), People (groups with chat, friends), Me, Wellbeing, Notifications.
- Group work happens in study groups; tasks and schedules are shared by code or in group chat.

## Capabilities and Constraints
- MERN stack; client is React 19 + Vite with plain CSS tokens in `client/src/App.css` (no Tailwind).
- Check-in scores are for the system to understand the student and adjust their schedule and tasks. They are not a diagnosis, and the app doesn't present them as one (owner, 2026-10-12).
- After a bad result the app rearranges the plan, recommends specific actions (for example sleeping earlier) and gives positive feedback (owner, 2026-10-12).
- AI reviewers use Gemini (free tier) from the server only; the key never reaches the browser.
- Deadline: the revamp must be presentable within 3 weeks of 2026-10-12.

## Brand Commitments
- Name: StressCare. Logo: `client/src/assets/logo.png` (heart mark).
- Palette: calm slate-blue accent, red only for the logo and alerts (owner, 2026-10-28).
- Fonts in use: Figtree (one family, self-hosted).
- Voice: plain, warm, student to student; no emoji in the UI (lucide icons instead); no em-dash connectors.

## Evidence on Hand
- PSS-10 (Cohen, Kamarck and Mermelstein, 1983) and WHO-5 (WHO, 1998), cited in the check-in dialogs.
- No testimonials, usage numbers or endorsements exist. Don't invent any. Team member names for the About page come from the owner.

## Product Principles
1. One screen, one job: what's next and whether the week is okay, in one glance on a phone.
2. Words before numbers; numbers stay available one tap deeper.
3. Every bad signal comes with a next step.
4. Red means stop: brand mark, overdue, delete, errors. Nothing else.
5. No pressure mechanics: no streaks, points or guilt.

## Accessibility & Inclusion
Text contrast 4.5:1 or better in light and dark mode, tap targets of 44px or more, nothing under 13px, `prefers-reduced-motion` respected, works from 320px wide (see `mobile-rules.md`).
