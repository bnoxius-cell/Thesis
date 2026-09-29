# Session handout

Read this first after a `/clear`. It's the short "where we left off" note. `CLAUDE.md` has the full project reference, this file only has the current state.

Last updated: 2026-09-30 (after main schedule, exams, suggestions)

## Where things stand
- **Current branch: `feature/main-schedule-exams-suggestions`, NOT committed yet** (previous branch `feature/dashboard-guidance-groups-profiles` is merged into main). Work on it: one main schedule + extras, exam/event entries feeding the workload, move suggestions, optional friend-share preview (see CLAUDE.md). Tests 228. Browser-checked: dashboard exam note, suggestion panel, schedule list sections, friend-share import preview. Not checked: Add exam modal, extra-vs-main overlap tags, Make this my main, dark mode, mobile.
- (Group/profile work below.) Server tests 192 passing, client builds. Details are in CLAUDE.md ("Dashboard focus, guidance, groups and profiles"). Checked in a browser: today panel (in-class, caught up, tomorrow), group roles list, member dialog, add friend, public profile. Not eyeballed: group settings dialog, icon upload, family-friendly toast, avatar upload, dark mode, mobile widths, friends page avatars. Restart the dev server for the new group fields.
- Older notes below.
- **Branch:** `polish/legal-and-visual-refresh`, pushed and merged into `main` (2026-09-30). Branch from `main` for the next piece of work. Server tests: 150 passing. Client builds, design detector clean.
- **Just finished:** Terms + Privacy pages and consent (sign-up checkbox, `TermsGate` for everyone else); schedule sharing rebuilt like task sharing (code or group chat post, import preview with conflicts, retime or skip entries, add to new or existing schedule); task import preview (already-added, busy-day warning, 409 on duplicates); sidebar grouping; motion pass; dashboard greeting summary and count-up.
- Checked in a browser against an in-memory server: chat schedule card, import dialog (duplicate and both clashes detected, added, card flips to "In your schedules"), task dialog, consent gate, terms page, sign-up checkbox. Not eyeballed: mobile widths, dark mode of the new dialogs, the auth-page drift on a real GPU.
- **Owner should confirm** the claims in the Privacy Policy (see CLAUDE.md, Terms section) before real users see it.
- **Not done:** other pages (Profile, Friends, Groups, Settings, About) only got the shared motion and hover polish, not a layout redo. No custom 404 (unknown URLs redirect home).

## Vercel fix (2026-09-29)
- Every git-triggered Vercel build had failed since Sep 18 (`vite: command not found`, exit 127). Cause: Root Directory was `./`, should be `client`. Set it to `client` in the dashboard and redeployed `main` (`0e15609`, PR #12 already merged). Live site now serves the latest build.
- Google OAuth origin for the Vercel URL was already present, no change needed. A real Google sign-in on the live site is still untried.
- Possible leftover: a second Vercel project named `client` (domain `client-indol-theta-46.vercel.app`) from an old CLI deploy. Harmless, delete in the dashboard if wanted.

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
- **Port 5000 is the owner's real dev server** (nodemon, real Atlas database), usually running along with Vite on 5173. Never run test servers on 5000. For manual UI testing, use an in-memory MongoDB (`mongodb-memory-server`) on another port, with `VITE_BACKEND_URL` pointing at it. Windows lets two processes bind the same port, which silently sends requests to the wrong server.
- **Restart the dev server** to pick up the notification changes (new model fields, routes, reminder job).
- Page wrapper class is `app app-layout` (not `app-container`), or the sidebar renders full width.
- A full page reload on any route redirects to `/dashboard` (known quirk), so deep links like `?s=<id>` or `?g=<id>` don't survive a refresh. Navigate in-app when testing.
- The browser `resize_window` tool doesn't work here. Probe mobile layouts with a fixed-width iframe instead. Screenshots of a hidden tab can time out, so retry or check computed styles.
- Global CSS styles bare `label`, `input`, `select` (column flex, width 100%). New form rows need explicit `flex-direction` and `width` overrides.
- The Bash tool choked on a long heredoc containing apostrophes. Use the Write or Edit tools for big files.
- Lint: `react-hooks/set-state-in-effect` on fetch-in-effect is an existing pattern (Groups, Friends, NotificationContext), not something new.
- `CLAUDE.md` is gitignored in this repo, so edits to it stay local.
