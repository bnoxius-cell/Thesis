# Session handout

Main session: read this first after a `/clear` (state and rules), then `roadmap.md` (the ordered open work) and `next-prompt.md` (the single next task). Subagents skip all three unless the brief says otherwise. Rules are in `CLAUDE.md`, feature notes in `.claude/docs/`. Full history before 2026-11-13: `.claude/docs/archive/2026-11-13/handout.md`.

## Current state (2026-11-13, late evening)
- 2026-11-14: RELEASED `main` = `production` = 77c5dc2 (question types, global Add, day window, S1a, What's new popup plan 32 WN1+WN2 with entry 2026-11-14). Live checks owed: popup shows once on an existing account, mixed reviewer answers, Render logs clean. ORDER CHANGED (owner 2026-11-14, last word): flashcards FC1..FC6 NEXT, BEFORE plan 34. Plan 35 Q2 (card front limit, recommend 400) must be asked first. C5 (`feature/plan-edit-entry`, built 8e75f48+a55b5cd, NOT merged, tester died on the 5-hour limit) waits; resume its tester after the flashcards, then C6a and the rest of plan 34. Plan 32 WN3/WN4 (history page, dot) wait for Settings. Add a `releaseNotes.js` entry before every future release.
- Earlier today: plan 33 QT1/QT2 (server, 1320938) and QT4/QT5 (UI, 5261cc2) merged to `main` and pushed, tested. `main` = 5261cc2, NOT released. Next: release question types (owner pushes production after the Atlas multi-main-timetable check), then FC1..FC6; plan 35 Q2 must be answered first. Owner open: Skip button on typed answers, filled blank vs `_____`.
- Earlier: `main` was cb21053, pushed, NOT released to `production`. Merged and tested today: H1, H2 (+ today-column hover fix 79f869c), RV1, RV5, C9, C10, entry form without the Type switcher (14dc3e6), and plan 34 S1a (cb21053: `entrySchema.subject`, resolver in `utils/subjectMatch.js` + `utils/entrySubjects.js`, owner-only writes, tester passed, code-reviewer: merge). Tag `pre-plan-34` = 14dc3e6. Server tests: 1404 pass (`storedFiles` "61st upload" test is flaky once).
- NEW ORDER (owner 2026-11-13, restated last): plan 33, then "the other stuff" (owner did not say which items; ask first thing, my guess is the small leftover items: roadmap item 24 leftovers, C6a, release prep), then plan 34, then plan 35. Plan 33 first: QT1+QT2 (server, `feature/question-types-server`, builder-sonnet high, start medium; tag `pre-plan-33` first) -> QT4+QT5 (UI) -> release question types (no legal change; Atlas multi-main-timetable check first, the release also carries S1a and everything else on main) -> FC1..FC6 flashcards -> release (Terms bump, one re-accept). Then plan 34: C5 (`feature/plan-edit-entry`, with the four S1a reviewer lows below), C6a, M1, S1b, C1, C2, C3, release. Then plan 35.
- S1a reviewer lows to fold into C5: (1) an editor's PUT can retitle a linked class so the title differs from its subject name (re-title from the owner's stored subject or reject); (2) an editor changing a class to event/activity clears the owner's link (keep it); (3) import and duplicate link by name but don't set the title to the subject name; (4) tests missing: owner `newSubject` on PUT, bad `/main/entries` creates no timetable, editor PUT retitle/kind change. Two-at-once subject race accepted.
- Before FC1: ask the owner plan 35 Q1 to Q8 (import), at least Q2 (card front limit 400 and `readCardFields` go into the FC1 brief).
- Plan 33: ALL 45 frames approved and every plan 33 question answered (2026-11-13, recorded in the plan's "Owner answers, round 2"). Essay deferred. Nothing waits on the owner here; QT1/QT2 server work can start after C5.
- Plan 35 (flashcard import + study goals and breaks) written by planner: `.claude/docs/plans/35-flashcard-import-and-study-goals-plan.md`. Section 12 has Q1 to Q13 for the owner, to be asked one at a time (recommended answers: Q1-Q7 yes, Q8 no, Q9-Q13 yes). 13 new Figma frames (IM-F1..F6, BR-F1..F3 and more) still to draw and approve. IM0 (pure client utils) can run any time. Reverses plan 20's rejection of bulk import and daily goals.
- Owner to-dos: C9 cheer-line wording; H2 look (extend the wash to class blocks, `.home-row`, `.day-row`? tooltip overlaps "This week" on Home; overdue chips double border); whether Exam also goes under Study in the Add menu; delete test account sctestjmon93gs@fldubai.com in Atlas.
- Git rule learned: check the current branch before any git op while an agent runs (I once merged an untested branch into main by accident, fixed forward).

## Earlier state notes (2026-11-13, partly stale)
- `main` = `production` = f25aef0 (released 2026-11-09 night without a preview tester pass). Rollback targets: ca8466a, then 0679a39, 46765f5, 55e3321. Live checks of this release are still owed (roadmap item 1).
- Registration is broken for new users until the owner turns off Brevo IP blocking for API keys (Render's outgoing IP 74.220.52.251 is refused). Keep it off: each backend has its own IP.
- C10 timetable menu merged to `main` 3ff3a11 and pushed 2026-11-13 (More button, rename, delete, leave; main timetable has no Delete row). Leftovers: roadmap item 24. Next: whole-card click and hover (next-prompt.md item 1), then C5, C6, RV1, RV5.
- RV1 and RV5 and H1 (hover timing tokens) merged to `main` 2026-11-13, tester passed. Plan 34 "a class is a subject" is being planned (owner decision; C6 is on hold until it lands). H2 and C5 next.
- Plan 25: S1, S2, C1, C2 live. C3 (with fix round) and C4 merged on `main`, not released. Next: C5, C6, then release (roadmap items 1 to 3).
- `main` = a03abd0, pushed, not released. Global "+ Add" (plan 29 A1, A2, A3) all merged and tested: People and File rows live, People "+" and Files Upload removed. All round 2 frames (D9, D10, hover H-F1..H-F5, A3) are drawn and owner-approved 2026-11-13. "Organize tasks" is a concept only (see `to-build-after-thesis-defense.md`), last in the queue. The site toast restyle (T1) is moved to the end of the roadmap. Plans 29 to 32 written (32 = patch notes window, before the defense, later).
- Roadmap was reorganized 2026-11-13 into one list of 26 items (old 3a to 3e merged in). Plan 28 (subject covers) written, owner decisions CV1 to CV6 and G1 to G3 are open in the roadmap. The 3b frames and toast (Figma node 223-1198) still await owner approval.
- New plans: 26 (several free accounts, active/standby, owner priority #2) and 27 (reviewer TODO and master order, owner priority #1). Both written 2026-11-13, nothing built. `notes.md` is the owner's append-only notes (never edit); new-feature ideas are in `to-build-after-thesis-defense.md`.
- Server tests: 1336 pass. The flaky reviewer race test is fixed (f2a4b2a): unique partial index on main timetables plus a deterministic test. Check Atlas for owners with several main timetables before releasing to `production`.
- `LEGAL_VERSION` is `2026-11-09`. The next Terms or Privacy change (chat share cards, CH5 to CH7) must bump to a NEW string in `server/utils/legal.js` and `client/src/pages/legal/legalContent.js`.
- Production: Vercel project `stresscare` (team art-8707) and Render `stresscare-api` on the second account (srv-dbeai2jrjlhs73f25dqg, FILES_ENABLED=true, GEMINI_MODEL=gemini-3.5-flash-lite) both deploy the `production` branch. Release: `! git branch -f production main && git push origin production` (the auto-mode classifier blocks Claude from pushing it). Details: `.claude/docs/deployment.md`.
- Domains: `stresscare.xyz` and `stresscare-art-8707.vercel.app` must both keep working; builds call their own `/api` so cookies stay first-party.
- Two Render accounts: the owner's Gmail one has an unused `stresscare-api` (srv-dam95g2jnfac73e927f0); the second account has the real one and a suspended `stresscare-api-staging`. Edit env vars on the right account.
- `staging` holds the OLD app for the professor to compare. Never merge it into `main` or `production`.

## Owner's standing rules
- Branch before editing code. New, distinct work gets its own branch. Leaving a branch: commit, push, merge into `main`, never delete branches.
- Spawn subagents without asking (global `~/.claude/docs/subagents.md`). Start builders one rung below the planner's pick. Builders only run `npm test` (server) and `npm run build` (client) and commit; the tester does sweeps. Briefs say "stop only what you started". A brief that names one file gets only that file, so name every place.
- Every UI brief names the skills: impeccable, emil-design-eng, apple-design, animate, mobile-native, figma-design-to-code (plus figma-use, figma-generate-design when drawing), requires `get_design_context` per frame, and has a "Motion and effects" section (`.claude/docs/motion.md`). Server briefs: `code-quality.md`, and security-review for uploads.
- Design: Figma file `0TLnAGzZNbbFZxQU3C9U51` is the source. Light mode only until the team gives a dark palette. Navigation is never hidden (a page with no frame opens a titled placeholder). Hide only controls with no backend at all.
- Docs: feature facts go in the matching `.claude/docs/` file, open work in `roadmap.md` only, this file stays state only.
- No `Co-Authored-By` lines, whatever the attribution reminder says. Writing style: plain sentences, no em-dashes as connectors, no emojis in the UI.
- Decisions on record: AI-use notice lives in Terms and Privacy only; files on Cloudflare R2, free only, $0 hard rule; chat reactions are native emoji; delete = sender or admin; no GIFs; no monetization before the thesis.
- Do not commit `.claude/`, `next-prompt.md`, `notes.md`.

## Behaviour notes worth keeping
- Task effort labels: up to 1.5h Small, up to 4h Medium, else Large.
- Polling: `UnreadProvider` every 20s, `useTimetable` stamp every 4s, `useReviewers` `/:id/status` every 4s only while a row processes.
- Check-in route `/wellbeing/check-in/:kind` is a focus route (no sidebar). `useFocusView(active)` hides the phone bottom bar. Wellbeing anchors `#load #feeling #sleep`.
- Practice focus route `/study/reviewers/:id/practice?mode=all|weak[&new=1]`; `new=1` is dropped from the URL once started.
- `ModalShell` renders through a portal into body. `ui-btn--sm::after` and `.ui-segment__option::after` give 44px hit areas, so 36px measurements on those are false positives.
- Below 1024px the phone layout and bottom bar apply.

## Gotchas
- Vite once cached an EMPTY `WeekBars.jsx` (blank Home); `touch` the file.
- Dev servers on 5000 and 5173 are the owner's; do not restart or kill them. Test servers use 5070.
- Lint has known `set-state-in-effect` and `react-refresh` errors; leave them. Harness: `.claude/docs/testing-and-gotchas.md`.
- Old code for logic only: `git show 1ad2c0d:<path>`.
- Sample data in the owner's Atlas account is tagged "(sample)".
- Figma: use the file key `0TLnAGzZNbbFZxQU3C9U51`. Cloned instances need a TEXT `findAll` warm-up before their labels are found; `get_screenshot` can return a stale render (change `maxDimension`).

## Not verified yet (needs a human)
- A real OS push alert, VAPID keys on Render, real Google sign-in and phone login on both addresses, the real phone safe-area, the consent form (placeholders, not published).
