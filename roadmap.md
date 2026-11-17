# Roadmap

The only list of open work, in order (reorganized 2026-11-14). Owner priority #1: quality of life of what is built. Priority #2: spread load over free accounts (plan 26). New features live in `to-build-after-thesis-defense.md`. State and rules: `handout.md`. Team feedback: `docs/KNOWN_ISSUES.md`. The owner's loose ideas go in `notes.md`; once an idea is here, it leaves `notes.md`. Old versions: `.claude/docs/archive/2026-11-13/` and `.claude/docs/archive/2026-11-14/` (the long small-items lists J, E, U, L and every original owner question are there).

Every batch: branch off `main`, builder runs `npm test` in `server/` and `npm run build` in `client/`, tester after, merge. "Start" is the builder to start with; step up only after a failed test. "Figma" means the frame is drawn (design skills loaded) and approved by the owner before the builder starts. Every push to `production` needs a What's new note first.

## PRIORITY NOW (owner 2026-11-17): three features before the defense
Everything else in this file is pushed back until after the defense. Plan: `.claude/docs/plans/40-group-collab-sharing-rollover-plan.md` (being written; batches and order go here once the owner answers its open decisions).
- **P1. Group workspace with live editing:** a group gets a shared schedule and shared tasks; any member (by role) edits a task and it changes for the whole group, like live editing in Google Docs.
- **P2. Share everything into a group:** tasks, schedules, courses (subjects), reviewers, flashcards, and files. A file sent in the chat can be downloaded to the device, or saved into the receiver's own StressCare storage. Folds in `next-prompt.md` (chat sharing, CH2 to CH7).
- **P3. New-semester schedule editing:** a fast way to replace or roll over the schedule with new courses when the semester ends.
- Already built and merged stays: nothing below gets deleted. Only unfinished items wait. Frames already drawn (F38, F39, plan 34, plan 35) keep their Figma nodes for later.

## PUSHED BACK UNTIL AFTER THE DEFENSE (owner 2026-11-17): the whole list below, groups A to L, E3 and E4 included
Open work, in order (reordered 2026-11-15: easiest first, grouped by feature; the 2026-11-14 order no longer applies). Nothing here gets built before P1 to P3 are done, unless the owner says so. In flight at the pause: E3 C2 and P2 wait on the owner's approval of frames F39-3 to F39-5; the Study frames F38 wait on approval; the Atlas and owner tasks at the bottom still stand.

Each group is one feature area, so a builder (and a Figma sitting) touches the same files once. Groups run from the easiest to the hardest; inside a group, the first item is the easiest. Dark mode stays last on purpose. Done so far and not listed here: colour 60/30/10 (merged, blue palette, soft sidebar; tester consistency pass running 2026-11-15), delete one notification, plan 34 S1a, S1b, M1, C5 and C6a. Items marked **[you decide]** wait on an answer from the owner: they are collected in "Decisions waiting on you" below.

**A. Small fixes and polish** CLOSED 2026-11-15 (merged to `main`: `fix/colour-consistency`, `fix/small-polish-2`, `fix/subject-link-followups`, `fix/band-and-tab-consistency`, `fix/watch-dot-cool`; all tested or reviewed). Leftovers moved on:
- Frame comparisons for the Figma round (no owner decision needed): Cancel pill vs frames 239:5577 and 239:5904; subject task row ring (`subject.css:178`) vs 76:878; More button outline vs 239:4833; search shows a flat list but the frame has group headings.
- Small known: Home greeting is 3 lines at 320; long email hints break inside "edu.ph" at 320; the all-decks flashcard review with no cards says "due tomorrow"; tour sheet is 4px taller on step 1.
- S1b test gaps: Bob's shared timetable stays unlinked on Alice's rename; the `linkMatchingItems` failure branch of create; one rename test doesn't hit the already-linked path; other controllers that save schedules still answer 500 on a stale save; the client shows the 409 message but doesn't reload.
- Moved: "Uploaded N files" toast (`useUploadDialog.js:35-44`) waits on group C. The vague "segment buttons 44px, Plan/Study/Wellbeing smells, animation pass" item is dropped: raise specific problems when those pages get their Figma round.
- Owner task: feel-test the Add sheet drag on a real phone.
- Colour follow-ups: Study Overview, Tasks and Settings look a little flat; subject soft tints are cool-toned.

**B. Infrastructure, plan 26 "do now" slice**
10. ~~N3 env hash script~~ DONE 2026-11-15 (`npm run env:hash` in `server/`, merged d5a6b5d; `/api/health` exposing `configHash` is plan 26 L2, after the defense). N1 Render audit DONE 2026-11-15 (numbers in `deployment.md`). N2 cold standby PARKED by the owner: replaced by the multi-server setup (plan 26).

**C. One site toast** (plan 29 T1, `feature/site-toast`, builder-sonnet medium)
11. ~~One site toast~~ DONE 2026-11-15 (merged bca1cb1, tester pass; needs a What's new item before a push). Original notes: approve the toast frames first (Toast/Added 221:4875, 221:4876 desktop, 223:715 phone). Bottom centre on desktop, above the tab bar on phones, polite, about 6 s, pauses on hover or focus, never covers the bottom nav or a Save button. 29 files call `toast.*` and `App.jsx:15` sets the container top-right: restyle and move react-toastify's container and add the View action before writing a new component. This also settles item 4's toast problem.

**D. Feedback dialog** (plan 17, `feature/feedback`)
12. ~~FB1, FB2~~ DONE 2026-11-15: merged to `main` (abbb19f, pushed, NOT on `production`), code-reviewer Merge, tester pass. Left: a What's new item for feedback before a push; `FEEDBACK_EMAIL` set and a real email arrived (2026-11-15, done); small notes: Segment options 35 to 36px and the Privacy Policy link 34px tall, the counter hides while an inline error shows. The Terms gate shows once after the next push (`LEGAL_VERSION` 2026-11-15).

**E. Wellbeing: sleep plan explainer**
13. ~~RV8~~ DONE 2026-11-15 (merged `main` db8da63, tester pass, What's new items added; phone view derived from the desktop frame, not drawn). Original: RV8 (`feature/sleep-explainer`, builder-sonnet medium): six answers in order: what it is, how to set it up, where to look, what to look for, what it means, what to change. Owner 2026-11-15 added: sleep is edited on the Tonight card (wake time, sleep target, travel; bedtime is worked out, saves as you change), and Your rhythm keeps only study hours and pace. Frame 332:567 drawn, awaiting approval; phone, closed and first-run frames still to draw. Server-side the bedtime derivation touches the profile route, so tester plus a quick diff read.

**E2. Next-step suggestions: never push a deadline later** (owner 2026-11-15, from a Home "Next step" card that said Move "ye" to Wed, Nov 18; `client/src/utils/suggestions.js` `suggestMoves`, shown by `features/home/NextStepCard.jsx`; builder-sonnet low, `feature/suggestions-no-later`)
13a. ~~DONE 2026-11-15 (plan 39 A1, merged `main` 70b4263, tester pass after one wording fix, What's new item added; ideas will be rare until B1)~~ Original: Suggestions may only pull a task EARLIER, never to a day after its written due date. A written deadline is the only real date we know, and moving past it would mean hoping it isn't the true one. Example: three big deadlines tomorrow (Monday) and an overloaded Monday: StressCare suggests doing one of them today, and never pushes any of them to Tuesday. Today the search moves open work back a day at a time (`suggestMoves`, header comment lines 5 to 7), so change it to search only days before the due date, and where no earlier day fits, say so plainly and leave the task alone. Reword the card text so it never reads as "move the deadline" (it should say when to do the work, for example "Do "ye" today instead of Monday"). Add tests: a suggestion never lands after the due date, and an overloaded day with only later options gives no suggestion. Check the workload score and `weekReasons` still read right when no move is offered.
13b. ~~DONE 2026-11-15 (merged `main` 17774c9, tester pass after one fix round; needs a What's new item; follow-ups below)~~ Original: Week chart says "Today looks heaviest" when today has 1 medium task and Monday has 3 large (owner 2026-11-15, Home "This week" card, Sunday evening). Cause: `buildWeek` (`client/src/utils/workload.js:157`) spreads each task's hours over every day from today to its due date, leaning toward days with room, so part of Monday's three large tasks lands on Sunday on top of the medium one. Today also keeps a full day of capacity even in the evening, and `heaviestDay` (`features/workload/useWorkload.js:34`) gives ties to the earlier day. **FRAME DRAWN 2026-11-15** (node 348:4956 in the Figma file, Plan page; owner picked a dotted-outline extension that wraps the bar (option B, explore frame 346:4956), "Monday looks heaviest. 3 big deadlines land on it.", short bar for today with "1.5 h left"): APPROVED by the owner 2026-11-15; next is a planner or builder-opus medium run. Fix (same file area as 13a, so do both together): (1) today's capacity only counts the hours left today, from the clock; (2) a task's weight shows on its due day, with earlier prep as a lighter part of the bar; (3) ties go to the day with the heavier due work. Never plan work past a due date (see 13a). Because it changes how the whole week reads (Home, Wellbeing, the score), draw the new bar and the "heaviest" wording in Figma first and get the owner's approval, then a planner or builder-opus medium run (shared maths, many callers: `buildWeek`, `computeWorkload`, `weekReasons`, `todayFocus`). Tests: 1 medium today plus 3 large tomorrow makes tomorrow heaviest; a late evening has almost no room left today; the existing workload tests still pass or are updated on purpose.
13b follow-ups (tester, not blockers): (1) the Next step "do it earlier" idea never showed in realistic overloaded weeks, because it only fires when the days before a deadline are fully booked (`suggestions.test.js` fixture was rewritten for this); decide whether to rework `suggestMoves`; (2) 18 h due in one day still rates "Steady week", the score's peak part may need due-day weight; (3) Plan page `dayLoad.js` ignores hours left today; (4) at 01:00 `hoursLeftToday` counts a 23:00 bedtime as later the same day; (5) hover label stays light, outline is CSS dashed not 3-on/3-off; (6) "Wellbeing" title wrapped to "Wellbein / g" at 320 in one run, check if it is a regression.

**E3. Expert evaluator feedback** (Guidance/IT expert Jennelie C. Lafrades, signed 2026-11-14, form in Downloads; she praised visual comfort, PSS-10 and WHO-5 grounding, the pattern-awareness framing, sharing roles and the Terms safety wording, and asked for two things)
13c. **C1 server DONE 2026-11-15 (merged `main` cd7358e, tester found 2 slips fixed by hand); frames F39-3 and F39-4 DRAWN, awaiting owner approval (ids in `design.md`); next C2 builder-sonnet medium.** Stress-source tag on check-ins: after a PSS-10 or WHO-5 check-in the student can pick a quick context label (Exams/Deadlines, Groupmates, Financial/Family, Health/Sleep), optional, one tap. Without it a personal or money worry reads as a scheduling problem. The server stores it with the check-in (scored on the server as usual), Wellbeing shows it in the history and the tips can use it. Not a diagnosis, never hotlines (product rule). Needs a planner run and Figma frames first (check-in result step and history), then builder-sonnet.
13d. **P1 util DONE 2026-11-15 (merged `main` 5e0cd9b, `client/src/utils/patterns.js`, 15 tests, nothing calls it yet); frame F39-5 DRAWN, awaiting owner approval; next P2, then L1 Privacy lines.** Passive behaviour signals: add signals StressCare already has to the workload picture, next to the self-reported scores: overdue tasks piling up, deadlines clustering at the last minute, a spike in reviewer generation right before exams, late-night app use. Planner first (what counts, thresholds, privacy: late-night activity needs a Privacy line and a `LEGAL_VERSION` bump). Shares the maths with 13a and 13b (`computeWorkload`, `weekReasons`), so plan the three together. Show these as "patterns we noticed", not a stress score.
13e. Thesis write-up: add her strengths and these two recommendations to `docs/reviewer-report.md` or the evaluation chapter, and record how each was answered.

**E4. Task page: one page per task** (owner 2026-11-15; needs a planner run and Figma frames first, then builder-sonnet; goes before F)
13f. Today a task only has the details window (`features/details/TaskDetails.jsx`). Its button "Open in Tasks" (`itemLinks.js` `taskHref`) just goes to `/plan?view=tasks&task=<id>` and highlights a row in the list, so there is nowhere to read a long description. Build a real page for one task, for example `/plan/tasks/:taskId`.
- **Opening it:** the window opened from Home, Plan (week, month, Tasks list), a subject page, search and notifications gets a clear "View task" button that goes to the page. `taskHref` points at the page, so search, the Add toast and "Open task" on the Next step and Why cards land there too. The old `?task=` link keeps working (redirect).
- **What the page shows:** title and subject chip first, then due date and time, effort, importance, status, then the full description in a readable column (line breaks kept, links clickable, no clipping), then anything else the task has (subject link, created and done dates). Key info first, long text below it.
- **What you can do there:** mark done, Edit and Delete (same dialogs and the same confirm as the window, not copies), Back to where you came from. Anyone who can only view a shared task sees no edit controls.
- **States:** loading, task not found or deleted (friendly message with a link back to Plan), no description ("No notes yet" with an Add link), a very long description and a very long title, signed-out redirect.
- **Check at:** 320, 375 and 1280 px, keyboard focus order, the browser Back button, and a deep link opened in a fresh tab.
- **Plan first:** a planner run decides the route, whether the server needs a `GET /api/tasks/:id`, and how shared tasks are handled. Figma frames (desktop and phone, normal, long description, empty, not found) drawn and approved before building. Reuse the details window's pieces; add no new UI library.
Question for the owner at planning time: should the window's "View task" replace "Open in Tasks", or should both exist?

**F. Study: reviewers, decks and the Study hub** (plan 38, `.claude/docs/plans/38-study-find-and-edit-plan.md`, PLANNED 2026-11-15, branch `feature/study-find-and-edit`, tag `pre-study-edit` first; the planner found subject Edit and Delete and the deck page edits already exist)
14. ~~Plan 38 Q1 to Q7~~ ANSWERED 2026-11-15, all defaults (colour picker in Edit subject now, no long press, plain Edit and Delete everywhere, tasks and classes keep Edit and Delete in the details window, edit a card while studying, Try again line "Counts toward your 10 reviewers a day.", hide More on a reviewer still being made). So C3 and C4 are IN. Plan 28's cover dialog now picks only pattern and symbol.
15. ~~S1 server DONE 2026-11-15 (merged main 70d70dd, tester pass)~~ Original: fix "No subject" leaving the old chip (decks and reviewers), let Edit reviewer create a new subject inline, give the "notes are gone" Try again error a code; two failed reviewers plus a `--fake-ai` flag in the harness (start builder-haiku high).
16. C2 More menu on deck rows (Edit, Delete) in both lists (builder-haiku high). C3 subject colour row in Edit subject, only if Q1 yes (builder-haiku high). C4 edit a card from the study screen, only if Q5 yes (builder-haiku high).
17. C1 reviewer Edit dialog, row and header More menu (Try again, Edit, Delete), Try again on the failed page (builder-sonnet low; this is old RV3). Needs S1. Tester checks the Study list, the subject Practice tab and the reviewer page.
18. Study Add menu order: Study's group in the global Add menu offers Task up front. **[you decide]** does Exam also go there? Figma touch-up first, then builder-sonnet low.
19. Study still shows a second "+ New subject" beside the global Add, check against the frame.
20. RV2 subject tag everywhere with eight real colours (`feature/subject-tag`, builder-sonnet medium; where "subject card is hard to find" lands). RV9 "Making your reviewer" screen (`redesign/reviewer-waiting`, builder-sonnet medium; keep the "writing questions" counter).
21. **DRAWN 2026-11-15, awaiting your approval (ids in `design.md`; three small questions in the handout).** Frames for this group (F38-1 to F38-6, plus the RV9 screen) in one Figma sitting; owner approves before C1 to C4. Then What's new note and release.

**G. Flashcard import and study goals** (plan 35, all 13 questions answered, Q8 no)
22. IM0 pure parser and break rules (any time, no Figma), IM1 import route, then IM-F1 to IM-F6 frames approved, IM2 dialog, BR-F1 to BR-F3 frames, BR1 and BR2 breaks, release. **[you decide]** flashcard end-screen wording.

**H. UX consistency** (plan 31 Part C, UX1 to UX6; Figma per fix where the plan says so)
23. The live pass of the audit is still to run. Known: Study tabs jump (tab 1 has a big card, tabs 2 and 3 don't); Month shows events, activities, holidays and uncoloured tasks as the same grey chip; the empty "current task" area needs a friendly empty state like Friends; empty states; nav labels; same spot for primary actions. **[you decide]** H2 look (extend the wash to class blocks, `.home-row`, `.day-row`?; the tooltip overlaps "This week" on Home; overdue chips double border) and C9 cheer-line wording.

**I. Subjects: plan 34 and covers** (hardest UI group; all touch the subject page)
24. Plan 34 (`.claude/docs/plans/34-class-is-subject-plan.md`): draw frames CT-F1 to CT-F4 (Meeting form, named "Meeting" per Q7), NT-F1 (Notes tab), OV-F1 to OV-F8 (Overview) in file `0TLnAGzZNbbFZxQU3C9U51`, owner approves. Do this in the same sitting as the Study Figma round below.
25. Study Figma round: plan 28 frames SC-F1 to SC-F4 plus round 27 F27-1 to F27-5 (F27-2 is plan 38's F38-2, draw once).
26. C1 Meeting form, C2 Notes tab (builder-sonnet), then C3 subject Overview redesign (key info first, Edit one tap away; the hardest batch; code-reviewer on anything that touches other users' timetables), then release.
27. Subject covers phase 1 (plan 28 SC1 to SC3, `feature/subject-covers`, SC1 builder-haiku medium, SC2 and SC3 builder-sonnet low).

**J. Account and trust** (`feature/` per item, builder-sonnet high, code-reviewer before merge; no plan written yet)
28. Auth hardening: user-lookup leaks (send-reset-otp, reset-password, login, register say "User not found"), server rate limit and resend cooldown, old sessions survive a password change, 180s vs 60s resend cooldown. Then account deletion, then the Terms re-accept screen (first-time users and users who agreed to the previous terms differ; needs a Figma look, uses `LEGAL_VERSION`).

**K. Organize tasks**
29. Concept only, see `to-build-after-thesis-defense.md`.

**L. Dark mode** (very last, owner 2026-11-15)
30. Light mode only until now. Rebuild the dark tokens on the blue 60/30/10 look (dark blue base, a slightly lighter blue sidebar and band, the same bright accent), update the Figma Color collection's Dark mode, then check every page at 375 and 1280 for 4.5:1 contrast. `tokens.css` already holds an older dark set to start from.

**Done, only live checks left**: plan 37 guide and tutorials (production cb368df), placeholder pages (shipped 2026-11-14), 0a edit/delete entries, upload limits and "New subject..." pickers (shipped e33e784). Checks are in the owner tasks below.

Not before the defense: see `to-build-after-thesis-defense.md` (reading reviewer type, subject cover photos, and more).

Before every `production` push: add the What's new items (the new toast, the colour change, other-student profile, Files back arrow, About gutter, small polish, notification delete if not already in) to the newest note file.

## Decisions waiting on you
Answer any of these in chat as a quick pick; I record the answer here and in the plan. Default in bold where there is one.
- **Plan 38 Q1 to Q7:** answered 2026-11-15, all defaults (see group F item 14).
- **Exam in the Study Add menu** (group F, item 18): does Exam also go up front next to Task?
- ~~Toast frames~~ approved 2026-11-15.
- **Skip button on typed answers** (reviewer practice): add one or not.
- **Filled blank vs `_____` after grading** (reviewer practice).
- **Flashcard end-screen wording** (group G).
- **C9 cheer-line wording** and **H2 look** (group H).
- **Frame approvals** as they get drawn: plan 34 CT, NT, OV (group I), plan 38 F38-1 to F38-6 (group F), plan 35 IM and BR frames (group G).

## Owner decisions on record
All design and plan questions were answered 2026-11-13 and 2026-11-14 and live in the plans; the original question lists are in the 2026-11-14 archive. In short: Mixed is the default question type; Study storage 200 MiB; PowerPoint/Word picture stripping only after the defense; photos over 4 MB only shrink; standby API on the owner's Gmail account; one Covers/Colours switch, soft tint plus top band, symbol guessed from the name, no picker in New subject, own cover photos after the defense, cover photos don't count toward storage; global Add button left of Search, Home is the Plan group, phone button in the top bar; shared timetables: owner and editors edit, viewers only see; a Month day opens the day window with "Open this week"; about six fixed cheer lines by how full the day is; done lines stay random; hover: whole day column soft, bar tooltip on desktop; page titles stay the section name; Month exam is icon plus title; Pick up moves inside the Subjects panel; toast closes after 6 s; feedback dialog stays; plan 35 Q8 no.

## Owner and thesis tasks (Claude cannot do these)
- Delete the test account sctestjmon93gs@fldubai.com, the 3 leftover test files, group `tester-chat` and the "(sample)" data in Atlas.
- Fill `client/src/utils/helpContacts.js` and the About team names.
- Real phone check on stresscare.xyz and the vercel.app link.
- Confirm VAPID keys on Render (srv-dbeai2jrjlhs73f25dqg) and test a real push.
- Point UptimeRobot at `/api/health`; remove dead monitors (`jarvis-bot-qcza`, `tomewisp`).
- Publish the consent form (placeholders: investigator, adviser, duration, contacts). Thesis core waits on experts: W2, W3, re-evaluation.
- Manual reviewer tests at the end of `docs/reviewer-report.md`.
- Re-link `client/.vercel/project.json` to `stresscare` before any manual CLI deploy.
- Delete `wellbeingController.js` and `wellbeingRoutes.js` (owner said yes 2026-10-13; a chore batch can do it).
- Live checks owed after the 2026-11-14 releases: What's new popup once and See all updates, bullets at 375px and 1280px, Render logs clean, flashcards (deck from a reviewer, review two cards, Terms re-accept once).
- Release command: `! git branch -f production main && git push origin production` (after a What's new note).

## Done (short)
- Storage and Study: foundation, Study hub, subject tabs, Practice, Files with folders and Move to, upload dialog, file viewer (live 2026-11-06). New reviewer sources: PDF, Word, PowerPoint, photos, Create new subject, Subject files.
- People, footer, security headers, `/api/health`, Practice "In progress", sign-in open to all users, reviewer share cards (server).
- Plan 25: S1, S2, C1 to C4, C9 day window, C10 timetable menu. Month shows everything Week shows. Unique main-timetable index.
- Plan 27: RV1 source line, RV5 heaviest-day ring (live). Plan 29: global Add A1 to A3. Plan 30: hover polish H1 and H2. Plan 34: S1a and the entry form without the Type switcher.
- Plan 33: question types (QT1 to QT5) and flashcards FC1 to FC6. Plan 32: What's new popup, modular dated notes, grouped entries, `/whats-new` page, bullets (production c7cfeb7, 2026-11-14). Drag-to-close for every phone sheet.
