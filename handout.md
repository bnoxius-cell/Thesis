# Session handout

Read this first after a `/clear`. It's the short "where we left off" note. `CLAUDE.md` has the full project reference, this file only has the current state.

Last updated: 2026-10-11 (AI reviewers: gaps filled, real Gemini verified)

## AI reviewers (in progress, branch `feature/ai-reviewer`, NOT merged)
- **Built, committed and pushed on the branch, not merged into `main` and not deployed.** PDF upload, Gemini-written reviewer (title, summary, key points, key terms, topics, multiple-choice questions with difficulty), Learning Mode one question at a time with server-side grading, results with per-topic breakdown, weak-topic practice, resume, new questions from the stored text. Page `/reviewers`, sidebar under Plan. Details in CLAUDE.md, "AI reviewers".
- **2026-10-11: the owner asked to check the original spec prompt against the code and fill what was missing.** Added: targeted review (`POST /api/reviewers/:id/targeted`, new questions on 1-3 chosen topics, added as a batch, practised on their own), chunking for long PDFs (up to 3 parts of 120k chars, sent at once and merged), select-then-Submit in Learning Mode, plain 500 messages (`serverError`), the AI writes the title when the student leaves it blank, and a third retry (30s) since the free tier often answers 503 for a minute. Kept on purpose: plain CSS instead of Tailwind (Tailwind isn't wired in this project), answers stored as `correctIndex` not answer text.
- **Real Gemini works.** The owner put `GEMINI_API_KEY` in `server/.env`. The smoke script and a headless-Chrome run of the real UI (against an in-memory API) both used real Gemini: 10/10 questions kept, 3 topics, 3/5/2 difficulty mix, AI title, 5/5 targeted questions. Server tests 316 passing, client builds.
- **Heads-up**: on 2026-10-11 `gemini-3.8-flash` (the default) timed out with 504 for a while even on one-word prompts, then recovered. `gemini-3.5-flash` answered when it didn't. If production sees "The AI service is busy" a lot, set `GEMINI_MODEL` on Render.
- **Before merging**: set `GEMINI_API_KEY` (same value as `server/.env`) on Render, then merge and check an upload on the live site. Optional: try a real PDF over 120k characters to exercise the split path against real Gemini (only tested with mocks).
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
- **When the Chrome extension isn't connected** (owner away, remote control), drive headless Chrome over CDP instead: start `chrome.exe --headless=new --remote-debugging-port=9333 --user-data-dir=<scratch>` and talk to it from a Node script with Node 24's built-in `WebSocket` (`Runtime.evaluate`, `Page.captureScreenshot`, `Emulation.setDeviceMetricsOverride` for 375px, `Input.dispatchKeyEvent` for keys). No downloads needed. Files can be handed to an `<input type=file>` with `DataTransfer` in page JS. Kill the Vite child process afterwards (`npx vite` leaves `node vite.js` running).
- **Port 5000 is the owner's real dev server** (nodemon, real Atlas database), usually running along with Vite on 5173. Never run test servers on 5000. For manual UI testing, use an in-memory MongoDB (`mongodb-memory-server`) on another port, with `VITE_BACKEND_URL` pointing at it. Windows lets two processes bind the same port, which silently sends requests to the wrong server.
- **Restart the dev server** to pick up the notification changes (new model fields, routes, reminder job).
- Page wrapper class is `app app-layout` (not `app-container`), or the sidebar renders full width.
- Deep links (`?s=`, `?g=`, `?code=`) now survive a full reload and a login (fixed 2026-10-10).
- The browser `resize_window` tool doesn't work here. Probe mobile layouts with a fixed-width iframe instead. Screenshots of a hidden tab can time out, so retry or check computed styles. Typing into a background tab can silently do nothing: set React inputs through the native value setter plus an `input` event. The open schedule page skips its live check while `document.hidden`, so override that when testing live updates.
- Global CSS styles bare `label`, `input`, `select` (column flex, width 100%). New form rows need explicit `flex-direction` and `width` overrides.
- The Bash tool choked on a long heredoc containing apostrophes. Use the Write or Edit tools for big files.
- Lint: `react-hooks/set-state-in-effect` on fetch-in-effect is an existing pattern (Groups, Friends, NotificationContext), not something new.
- `CLAUDE.md` is gitignored in this repo, so edits to it stay local.
