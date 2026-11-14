# Session handout

Main session: read this first after a `/clear` (state and rules), then `roadmap.md` (the ordered open work) and `next-prompt.md` (the single next task, if it exists). Subagents skip all three unless the brief says otherwise. Rules are in `CLAUDE.md`, feature notes in `.claude/docs/`. History: `.claude/docs/archive/2026-11-13/handout.md` and `.claude/docs/archive/2026-11-14/handout.md` (the long per-day log).

## Current state (2026-11-14, end of session)
- `production` = `main` = c7cfeb7 (owner pushed). Shipped today: flashcards, question types, What's new grouped by update with the `/whats-new` page, bullets on the items, drag-to-close phone sheets. Release notes `2026-11-13`, `2026-11-14-3`, `2026-11-14-4`. Live checks still owed (list in `roadmap.md`, "Owner and thesis tasks").
- Order now (owner 2026-11-14, last word): placeholder pages first (Notifications, Me/Settings/Privacy/Help, About), then plan 34, plan 35, the rest. Planner was spawned to write `.claude/docs/plans/36-placeholder-pages-plan.md` (refresh of plan 15). When its report lands: ask the owner its design questions as quick-answer questions, record the answers in `.claude/docs/design.md`, draw the FG1 frames in Figma (file key `0TLnAGzZNbbFZxQU3C9U51`; load `figma:figma-use`, `figma:figma-generate-design`, impeccable), get each approved, then build Settings first.
- Unmerged: `feature/plan-edit-entry` (plan 34 C5, built 8e75f48 + a55b5cd, tester died on the 5-hour limit, needs a tester pass). The four S1a reviewer lows to fold into C5: (1) an editor's PUT can retitle a linked class so the title differs from its subject name; (2) an editor changing a class to event/activity clears the owner's link; (3) import and duplicate link by name but must not set the title to the subject name; (4) missing tests: owner `newSubject` on PUT, bad `/main/entries` creates no timetable, editor PUT retitle/kind change.
- Server tests: about 1520 pass (the `storedFiles` "61st upload" test is flaky once). Tags: `pre-flashcards`, `pre-plan-34`, `pre-plan-27`, `pre-site-v3`.
- The git worktree `..\thesis-wn` can be removed (remove its two node_modules junctions with PowerShell `Remove-Item` on the junction first, then `git worktree remove ..\thesis-wn --force`).
- `LEGAL_VERSION` is `2026-11-14`. The next Terms or Privacy change must bump it in `server/utils/legal.js` and `client/src/pages/legal/legalContent.js`.
- Registration needs Brevo IP blocking for API keys off (Render's outgoing IP 74.220.52.251). Keep it off: each backend has its own IP.
- Production: Vercel project `stresscare` (team art-8707) and Render `stresscare-api` on the second account (srv-dbeai2jrjlhs73f25dqg, FILES_ENABLED=true, GEMINI_MODEL=gemini-3.5-flash-lite) both deploy the `production` branch. Details: `.claude/docs/deployment.md`. The owner's Gmail Render account has an unused `stresscare-api` (srv-dam95g2jnfac73e927f0); the second account also has a suspended `stresscare-api-staging`.
- Domains: `stresscare.xyz` and `stresscare-art-8707.vercel.app` must both keep working; builds call their own `/api` so cookies stay first-party.
- `staging` holds the OLD app for the professor to compare. Never merge it into `main` or `production`.

## Owner's standing rules
- Branch before editing code. New, distinct work gets its own branch. Leaving a branch: commit, push, merge into `main`, never delete branches. Check the current branch before any git op while an agent runs (I once merged an untested branch into main by accident).
- Spawn subagents without asking (global `~/.claude/docs/subagents.md`). Start builders one rung below the planner's pick. Builders only run `npm test` (server) and `npm run build` (client) and commit; the tester does sweeps. Briefs say "stop only what you started". A brief that names one file gets only that file, so name every place.
- Every UI brief names the skills: impeccable, emil-design-eng, apple-design, animate, mobile-native, figma-design-to-code (plus figma-use, figma-generate-design when drawing), requires `get_design_context` per frame, and has a "Motion and effects" section (`.claude/docs/motion.md`). Server briefs: `code-quality.md`, and security-review for uploads.
- Design: Figma file `0TLnAGzZNbbFZxQU3C9U51` is the source. Light mode only until the team gives a dark palette. Navigation is never hidden (a page with no frame opens a titled placeholder). Hide only controls with no backend at all.
- Docs: feature facts go in the matching `.claude/docs/` file, open work in `roadmap.md` only, loose ideas in `notes.md` until they're in the roadmap, this file stays state only.
- No `Co-Authored-By` lines, whatever the attribution reminder says. Writing style: plain sentences, no em-dashes as connectors, no emojis in the UI.
- Decisions on record: AI-use notice lives in Terms and Privacy only; files on Cloudflare R2, free only, $0 hard rule; chat reactions are native emoji; delete = sender or admin; no GIFs; no monetization before the thesis.
- Do not commit `.claude/`, `next-prompt.md`, `notes.md`.
- RELEASE GATE: before every `production` push, add a What's new note file in `client/src/features/whats-new/notes/` (date as file name), merge it, then ask the owner to push. The auto-mode classifier blocks Claude from pushing `production`: `! git branch -f production main && git push origin production`.

## Behaviour notes worth keeping
- Task effort labels: up to 1.5h Small, up to 4h Medium, else Large.
- Polling: `UnreadProvider` every 20s, `useTimetable` stamp every 4s, `useReviewers` `/:id/status` every 4s only while a row processes.
- Check-in route `/wellbeing/check-in/:kind` is a focus route (no sidebar). `useFocusView(active)` hides the phone bottom bar. Wellbeing anchors `#load #feeling #sleep`.
- Practice focus route `/study/reviewers/:id/practice?mode=all|weak[&new=1]`; `new=1` is dropped from the URL once started.
- `ModalShell` renders through a portal into body. `ui-btn--sm::after` and `.ui-segment__option::after` give 44px hit areas, so 36px measurements on those are false positives.
- Below 1024px the phone layout and bottom bar apply.

## Gotchas
- Vite once cached an EMPTY `WeekBars.jsx` (blank Home); `touch` the file.
- Dev servers on 5000 and 5173 are the owner's; do not restart or kill them. Test servers use 5070 (another process sometimes holds it; testers then use 5071).
- Lint has known `set-state-in-effect` and `react-refresh` errors; leave them. Harness: `.claude/docs/testing-and-gotchas.md`.
- Old code for logic only: `git show 1ad2c0d:<path>`.
- Sample data in the owner's Atlas account is tagged "(sample)".
- Figma: cloned instances need a TEXT `findAll` warm-up before their labels are found; `get_screenshot` can return a stale render (change `maxDimension`).

## Not verified yet (needs a human)
- A real OS push alert, VAPID keys on Render, real Google sign-in and phone login on both addresses, the real phone safe-area, the consent form (placeholders, not published), the bullets look on the live site.
