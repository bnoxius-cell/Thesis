# Session handout

Read this first after a `/clear`. It's the short "where we left off" note. `CLAUDE.md` has the full project reference, this file only has the current state.

Last updated: 2026-10-12. Branch `docs/system-review` holds a new `system-review.md` (not committed yet). No app code changed.

## System review (2026-10-12)
- The owner asked for a full review (bugs, broken parts, redundancy) with instructions Sonnet can build from. It's in `system-review.md` at the project root: findings first, then 11 batches, each with a branch name, steps and tests.
- Top items: password-reset codes can be guessed with no attempt limit (S1, High); there's no "Forgot password" screen at all (B1, High); unverified accounts can be claimed through Google linking (S2); removed group members can rejoin by group id (S3); check-in scores are trusted from the browser (S5).
- Before Sonnet starts: get the owner's answers to the three decisions at the top of the work list (well-being goal direction, sleep fields, reset wording). Batches 1 and 5 touch auth, so Opus reviews those diffs before merging.
- Checked while reviewing: 375/375 server tests pass, client builds (one 628 KB chunk), lint has 20 errors (mostly the known setState-in-effect pattern).

## Next up
Start with `system-review.md` (above). Older list, still valid:
1. **Real phone pass on the live site** (owner, or with them): the Guide's bottom sheet, the new confirm dialogs, login sticking after the API proxy change, the schedule workspace, a reviewer upload. All are only checked at phone width in a desktop browser so far.
2. Small fixes seen on 2026-10-11, not done: the dashboard's "Next exam" pill wraps into narrow columns at 375px; the Rename schedule dialog doesn't close on Escape.
3. The page-by-page redesign list in CLAUDE.md (Profile, Friends, Groups, Notifications, Settings, About, Auth). Read `mobile-rules.md` first: every UI change is also done for mobile in the same change.
4. Owner's manual reviewer tests (end of `reviewer-report.md`).

## Dialogs, Guide button, mobile rule (2026-10-11, merged as PR #20)
- **Merged into `main` as PR #20 and live** (checked: the Vercel bundle has the Guide). No server changes. Branch from `main` for the next piece of work.
- What changed (details in CLAUDE.md, "Dialogs and the page Guide"): every confirm in the app now uses `ConfirmDialog` (TaskBoard mark as done and delete, task-tag copy fallback, Friends remove, Notifications clear all; the old `.confirm-card` CSS is gone). New bottom-right **Guide** button on Dashboard, Schedule and Reviewers with step-by-step help that outlines each section. New `mobile-rules.md` (root) with the "do it for mobile in the same change" rule, pointed to from CLAUDE.md.
- **Tested in the owner's Chrome** (extension) against an in-memory API on 5070 + Vite on 5174 (real DB untouched): all four dialogs (mark done, delete, remove friend, clear all, plus the forced copy fallback), every Guide step on all three pages and their views (dashboard 7 steps, schedule list 4 and open schedule 4, reviewer list 3, open reviewer 5, Learning Mode 1), Escape/arrow keys, no console errors. Phone widths via a same-origin iframe at 375px and 320px: bottom sheet, 44px tap targets, no horizontal scroll, button clears the footer and Learning Mode's Submit. Contrast measured in light and dark (panel text 6:1 or better, icon 3.7:1 in dark).
- Decision made without asking (architecture, easy to change): "guide seen" is stored per browser (localStorage), not on the server, since it only controls the small dot.
- Not checked: a real phone. Seen while testing, not touched: on a 375px phone the dashboard's "Next exam" pill wraps into narrow columns; the Rename schedule dialog doesn't close on Escape.

## AI reviewer test and fix pass (2026-10-11, branch `test/ai-reviewer-finalize`)
- The owner asked for a full test, debug and finalize pass on the reviewer feature. Full write-up for the thesis: `reviewer-report.md` (architecture, files, env vars, endpoints, every test, problems fixed, limitations, manual tests).
- Fixed: empty/cut-off Gemini answers and timeouts now retried; bad key/model gives "Reviewers aren't working on our side" instead of "try a different PDF"; a failed "New questions" keeps the old set (status back to `ready` with `error`); the last answer closes and scores the session (refresh before results no longer loses it); double-submitted uploads return the first reviewer; questions without explanations dropped; long unbroken words no longer widen the reviewer past a phone screen; Gemini timeout 100s to 150s and stuck cutoff 9 to 12 min (a real targeted request on a long PDF took 99.7s).
- Verified: 375 server tests pass (new: `reviewer.workflow`, `reviewer.e2e`, `gemini.http`, fake Gemini helper, Chrome-made handout fixture). Headless Chrome against a test server at 320/375/768/1280px, light and dark. Real Gemini on the handout and on a 74-page, 301k-character PDF (3 parts, recovered from two 503s). No key in the code, git history, local build or live bundle.
- Still for the owner (also in the report): a real upload on the live site, a real phone, a real scanned and a real password-protected PDF, several students at once, and a subject expert checking answer accuracy.

## AI reviewers (merged as PR #17, live 2026-10-11)
- **Merged into `main` and live.** The owner set `GEMINI_API_KEY` on Render. Checked after the merge: Render answers the new routes (`/api/reviewers/:id/targeted` returns JSON), the Vercel bundle has the new UI, and `/api/reviewers` answers through the Vercel proxy. Not yet done: a real upload in production (needs a signed-in account), so the owner should try one.
- What it does: PDF upload, Gemini-written reviewer (title, summary, key points, key terms, topics, multiple-choice questions with difficulty), Learning Mode one question at a time with server-side grading, results with per-topic breakdown, weak-topic practice, resume, new questions from the stored text. Page `/reviewers`, sidebar under Plan. Details in CLAUDE.md, "AI reviewers".
- **2026-10-11: the owner asked to check the original spec prompt against the code and fill what was missing.** Added: targeted review (`POST /api/reviewers/:id/targeted`, new questions on 1-3 chosen topics, added as a batch, practised on their own), chunking for long PDFs (up to 3 parts of 120k chars, sent at once and merged), select-then-Submit in Learning Mode, plain 500 messages (`serverError`), the AI writes the title when the student leaves it blank, and a third retry (30s) since the free tier often answers 503 for a minute. Kept on purpose: plain CSS instead of Tailwind (Tailwind isn't wired in this project), answers stored as `correctIndex` not answer text.
- **Real Gemini works.** The owner put `GEMINI_API_KEY` in `server/.env`. The smoke script and a headless-Chrome run of the real UI (against an in-memory API) both used real Gemini: 10/10 questions kept, 3 topics, 3/5/2 difficulty mix, AI title, 5/5 targeted questions. Server tests 316 passing, client builds.
- **Heads-up**: on 2026-10-11 `gemini-3.8-flash` (the default) timed out with 504 for a while even on one-word prompts, then recovered. `gemini-3.5-flash` answered when it didn't. If production sees "The AI service is busy" a lot, set `GEMINI_MODEL` on Render.
- **Next**: the owner tries an upload on the live site. (The long-PDF split path has now been run against real Gemini, see the test pass above.) Everyone will see the Terms prompt once (the `LEGAL_VERSION` bump).
- **Gemini tier**: the owner has Google AI Pro, but that's the Gemini app subscription and doesn't make an API key paid. The key is free tier unless a billing account is linked to its project (AI Studio shows the tier next to the key). The Privacy Policy keeps the free-tier wording until that's confirmed.
- **Decisions made earlier (owner said "you decide")**: keep the extracted text (now capped at 360k chars) so "New questions" and targeted review work without re-uploading; reviewers are private (no sharing yet). Free-tier privacy wording was written, and `LEGAL_VERSION` was bumped to `2026-10-10` (everyone re-accepts once after deploy; one-line revert in `server/utils/legal.js` + `LEGAL_UPDATED` if unwanted).
- Pre-existing, not touched: `npm audit` shows 5 issues in the server (nodemailer, mongoose, proxy-addr, qs, body-parser), none from the new packages. Dark-mode palette gaps noted in CLAUDE.md (Design system).

## Where things stand (before AI reviewers)
- **Schedule workspace (2026-10-10), branch `feature/schedule-workspace`, merged into `main` as PR #15 and live on Vercel and Render (checked: new bundle served, `/stamp` route answers).** Create Task page removed (tasks are added from the schedule, in its theme, and show on their due day), Philippine-only holidays on a month calendar with range selection, Google Docs-style sharing (viewer/editor roles, editors-can-share setting, general access by code or link, make private, make a copy), online class links with Join buttons, 4-second live updates, and deep links that survive a reload or login. Details in CLAUDE.md, "Schedule workspace". Server tests 258 passing, client builds.
- Checked in a browser against an in-memory server (desktop width, plus a 375px iframe probe): task form and due chips, Add/More/Theme menus, Info section with meeting link, holiday calendar (range select, name, remove a public holiday), share dialog (code on, role switch, editors-can-share, make private), live update from another user (about 2s), opening a share link while signed out, viewer details card with Join, make a copy, dashboard Join button. Contrast of the new pieces measured at 4.5:1 or better in all 6 themes, light and dark. **Not eyeballed**: dark mode by screenshot (only measured), a real phone, the week view's per-day day-off button after the calendar change.
- The sharing wording change in Terms/Privacy is now covered by the `LEGAL_VERSION` bump on the AI reviewer branch.
- **Next up**: try it on a real phone; then the page-by-page redesign list in CLAUDE.md (Profile, Friends, Groups, Notifications, Settings, About, Auth). Branch from `main` for new work.
- All earlier branches (`feature/shared-schedule-editing`, `feature/main-schedule-exams-suggestions`, etc.) are merged into `main`. Older notes below are history.

## Vercel fix (2026-09-29)
- Every git-triggered Vercel build had failed since Sep 18 (`vite: command not found`, exit 127). Cause: Root Directory was `./`, should be `client`. Set it to `client` in the dashboard and redeployed `main` (`0e15609`, PR #12 already merged). Live site now serves the latest build.
- Google OAuth origin for the Vercel URL was already present, no change needed. A real Google sign-in on the live site is still untried.
- Possible leftover: a second Vercel project named `client` (domain `client-indol-theta-46.vercel.app`) from an old CLI deploy. Harmless, delete in the dashboard if wanted.
- Heads-up (2026-10-10): this machine's `client/.vercel/project.json` is linked to that leftover `client` project, not `stresscare`. Git pushes still deploy correctly, but a manual `vercel` CLI deploy from `client/` would go to the wrong project. Run `vercel link` and pick `stresscare` before deploying by hand. (The Vercel CLI isn't installed on this machine right now, and the Vercel connector has no access to the `art-8707` team.)

## Mobile login fix (2026-09-29, needs a phone test)
- Login didn't stick on phones: the cookie was third-party (site on vercel.app, API on onrender.com). Fix merged as PR #13 on branch `fix/mobile-login-cookie`: `client/vercel.json` proxies `/api/*` to Render, and Production `VITE_BACKEND_URL` was set to `https://stresscare-art-8707.vercel.app`, then redeployed.
- Verified: live bundle has the Vercel URL baked in (no onrender or localhost), and `/api/*` on the Vercel domain returns the API's JSON.
- **Not verified: an actual login on a phone** (email and Google). If it still bounces back to the login page, ask which phone and browser, then look at the cookie options in `authController.js` (`sameSite`, `secure`, and whether `trust proxy` is needed on Express behind Render and Vercel).
- Current branch is `fix/mobile-login-cookie` (already merged into `main`). Branch from `main` for the next piece of work.

## Not verified yet (needs a human)
- **Actual OS push alert.** Chrome's permission prompt can't be clicked by automation. Click "Turn on" under "On this device" on the Notifications page, allow it, then have another account post in a shared group while the tab is in the background or closed.
- **Phone.** Needs the deployed HTTPS site. On iPhone: Add to Home Screen first.

## Next up
1. **Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` on Render** (copy from `server/.env`). Without them push is off in production, the in-app inbox still works.
2. Try the push flow above, then commit, push and merge when moving to the next piece of work.
3. Look at the auth page in a browser (eye toggle, new copy, mobile width), still unchecked from the last task.
4. Existing to-do list in `CLAUDE.md` (page-by-page design rollout, Google OAuth origin for the Vercel URL, etc.) is unchanged.

## Owner's standing rules (from global CLAUDE.md, easy to forget)
- Branch before editing code. When starting new, distinct work, commit, push and merge the old branch into `main` automatically, but never delete branches.
- Never spawn subagents without asking first.
- **This project has no `frontend-plan.md` on purpose.** Don't ask for one. Follow the current design system, and only ask questions about architecture, not design.
- No `Co-Authored-By` lines in commits or PRs.
- Docs: after each task, update `CLAUDE.md` and `handout.md`. Anything still in progress or unfinished goes in `handout.md`; if nothing is pending, just `CLAUDE.md`.
- Writing style: plain sentences, no em-dashes as connectors, no "not just X, it's Y". No emojis in UI (use lucide-react).

## Gotchas
- **Chrome extension quirks (2026-10-11)**: clicking by `ref` sometimes misses small or animated buttons (the friend ✕, Notifications "Clear all"); click by coordinates from a screenshot, or `.click()` in page JS. A `key` press acts on whatever is under the mouse (an ArrowRight with the cursor over the Guide button closed the guide), so `hover` somewhere empty first. Screenshots time out while the tab is hidden; retry once it's in front. Typing into the login form can silently do nothing in a background tab, so sign in with `fetch('/api/auth/login', { credentials: 'include' })` from the page and reload.
- **UI test harness**: a Node script that starts `mongodb-memory-server`, imports `server/app.js`, listens on 5070, registers an account through the API, sets `isAccountVerified` + `termsVersion` directly on the model, and seeds tasks, a schedule and a ready reviewer. Run Vite with `VITE_BACKEND_URL=http://localhost:5070 npx vite --port 5174 --strictPort`. The 2026-10-11 script lived in that session's scratchpad (gone now); rebuild it from this description, or ask the owner if it should live in `server/scripts/`.
- **When the Chrome extension isn't connected** (owner away, remote control), drive headless Chrome over CDP instead: start `chrome.exe --headless=new --remote-debugging-port=9333 --user-data-dir=<scratch>` and talk to it from a Node script with Node 24's built-in `WebSocket` (`Runtime.evaluate`, `Page.captureScreenshot`, `Emulation.setDeviceMetricsOverride` for 375px, `Input.dispatchKeyEvent` for keys). No downloads needed. Files can be handed to an `<input type=file>` with `DataTransfer` in page JS. Kill the Vite child process afterwards (`npx vite` leaves `node vite.js` running).
- **Port 5000 is the owner's real dev server** (nodemon, real Atlas database), usually running along with Vite on 5173. Never run test servers on 5000. Also avoid 5060 and 5061 for test servers: Chrome blocks them as unsafe ports ("Failed to fetch"). 5070 works. New accounts need email verification before the app lets them in; a test harness has to mark `isAccountVerified` itself. For manual UI testing, use an in-memory MongoDB (`mongodb-memory-server`) on another port, with `VITE_BACKEND_URL` pointing at it. Windows lets two processes bind the same port, which silently sends requests to the wrong server.
- **Restart the dev server** to pick up the notification changes (new model fields, routes, reminder job).
- Page wrapper class is `app app-layout` (not `app-container`), or the sidebar renders full width.
- Deep links (`?s=`, `?g=`, `?code=`) now survive a full reload and a login (fixed 2026-10-10).
- The browser `resize_window` tool doesn't work here. Probe mobile layouts with a fixed-width iframe instead. Screenshots of a hidden tab can time out, so retry or check computed styles. Typing into a background tab can silently do nothing: set React inputs through the native value setter plus an `input` event. The open schedule page skips its live check while `document.hidden`, so override that when testing live updates.
- Global CSS styles bare `label`, `input`, `select` (column flex, width 100%). New form rows need explicit `flex-direction` and `width` overrides.
- The Bash tool choked on a long heredoc containing apostrophes. Use the Write or Edit tools for big files.
- Lint: `react-hooks/set-state-in-effect` on fetch-in-effect is an existing pattern (Groups, Friends, NotificationContext), not something new.
- `CLAUDE.md` is gitignored in this repo, so edits to it stay local.
