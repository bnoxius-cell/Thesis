# Session handout

Read this first after a `/clear`. It's the short "where we left off" note. `CLAUDE.md` has the full project reference, this file only has the current state.

Last updated: 2026-10-10 (schedule workspace)

## Where things stand
- **Newest (2026-10-10), branch `feature/schedule-workspace`, merged into `main` as PR #15 and live on Vercel and Render (checked: new bundle served, `/stamp` route answers).** Create Task page removed (tasks are added from the schedule, in its theme, and show on their due day), Philippine-only holidays on a month calendar with range selection, Google Docs-style sharing (viewer/editor roles, editors-can-share setting, general access by code or link, make private, make a copy), online class links with Join buttons, 4-second live updates, and deep links that survive a reload or login. Details in CLAUDE.md, "Schedule workspace". Server tests 258 passing, client builds.
- Checked in a browser against an in-memory server (desktop width, plus a 375px iframe probe): task form and due chips, Add/More/Theme menus, Info section with meeting link, holiday calendar (range select, name, remove a public holiday), share dialog (code on, role switch, editors-can-share, make private), live update from another user (about 2s), opening a share link while signed out, viewer details card with Join, make a copy, dashboard Join button. Contrast of the new pieces measured at 4.5:1 or better in all 6 themes, light and dark. **Not eyeballed**: dark mode by screenshot (only measured), a real phone, the week view's per-day day-off button after the calendar change.
- **Owner decisions pending**: the Terms/Privacy text about sharing changed, but `LEGAL_VERSION` was not bumped, so nobody is asked to re-accept. Bump it if you want that.
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
- **Port 5000 is the owner's real dev server** (nodemon, real Atlas database), usually running along with Vite on 5173. Never run test servers on 5000. For manual UI testing, use an in-memory MongoDB (`mongodb-memory-server`) on another port, with `VITE_BACKEND_URL` pointing at it. Windows lets two processes bind the same port, which silently sends requests to the wrong server.
- **Restart the dev server** to pick up the notification changes (new model fields, routes, reminder job).
- Page wrapper class is `app app-layout` (not `app-container`), or the sidebar renders full width.
- Deep links (`?s=`, `?g=`, `?code=`) now survive a full reload and a login (fixed 2026-10-10).
- The browser `resize_window` tool doesn't work here. Probe mobile layouts with a fixed-width iframe instead. Screenshots of a hidden tab can time out, so retry or check computed styles. Typing into a background tab can silently do nothing: set React inputs through the native value setter plus an `input` event. The open schedule page skips its live check while `document.hidden`, so override that when testing live updates.
- Global CSS styles bare `label`, `input`, `select` (column flex, width 100%). New form rows need explicit `flex-direction` and `width` overrides.
- The Bash tool choked on a long heredoc containing apostrophes. Use the Write or Edit tools for big files.
- Lint: `react-hooks/set-state-in-effect` on fetch-in-effect is an existing pattern (Groups, Friends, NotificationContext), not something new.
- `CLAUDE.md` is gitignored in this repo, so edits to it stay local.
