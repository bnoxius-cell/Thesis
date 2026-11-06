# Session handout

Main session only: read this first after a `/clear` (state), then `roadmap.md` (what is next). Subagents skip both unless their brief says otherwise. Rules are in `CLAUDE.md`, feature notes in `.claude/docs/`.

Last updated: 2026-11-06. Open work: see `roadmap.md`.

- **TOP PRIORITY reminder for the owner: the ITPM video recording** (set 2026-11-06). Say it first in the next session until they confirm it's done.

## Branches and releases
- `main` = efffd91 (Pe5). Backup tags: `pre-site-v3` (1ad2c0d, the old pages; restore a file with `git checkout 1ad2c0d -- <path>`), `pre-parity`. `production` = efffd91 (Pe3, Pe4, Pe5 and the API bandwidth fix live, all tester-passed 2026-11-06).
- `fix/tasks-empty-main` (off `main`, not merged): 26c5063 Tasks view fills the page when nothing is due this week (`TasksView.jsx`, `tasks-view.css`), 1287134 removed the logout success toast (owner: toasts feel AI-made). Build-checked only.
- Pe3 (Friends, Student profile), Pe4 (Group Info, Edit name, Pin a note) and Pe5 (New group, Join a group) are merged and live; branches `feature/people-friends`, `feature/people-group-info`, `feature/people-new-join-group` stay. Next: roadmap sections D (Figma frames FG1), E (storage, R2 setup), then N1, M1 to M3, AB1.
- Live site: `main` no longer deploys. Vercel project `stresscare` (prj_1IziDjCwE1rDiKqA5PbtCsHPXIRz, team slug art-8707) and Render `stresscare-api` (second account, srv-dbeai2jrjlhs73f25dqg) both deploy the `production` branch. Release = `git branch -f production main && git push origin production`. The owner added both as allow rules in `.claude/settings.json` (untracked, never commit it); the auto-mode classifier may still block the push as a production deploy, then tell the owner. Promote only after a tester pass.
- `staging` holds the OLD production app (4cb8fe5, ebc1a28 code plus its own `client/vercel.json` `/api` rewrite) so the professor can compare. Old: https://stresscare-git-staging-art-8707.vercel.app (staging API, `stresscare_staging` DB, needs a test sign-up, 50s cold start). Never merge `staging` into `main` or `production`: an earlier merge carried the staging `/api` rewrite into `client/vercel.json` (fixed in 5bad3dd).
- Domains: `stresscare.xyz` (apex; `www` 308-redirects) AND `stresscare-art-8707.vercel.app` must both keep working. Google OAuth lists xyz, www.xyz and the old origins. Server `CLIENT_URL` takes a comma-separated list (`server/app.js`) and is set on both Render services. Deployed client builds ignore `VITE_BACKEND_URL` and call their own `/api` (e8a962f) so cookies stay first-party on both addresses. Details in `.claude/docs/deployment.md`.
- Two Render accounts: the owner's (Gmail) has `stresscare-api` srv-dam95g2jnfac73e927f0 (stresscare-api.onrender.com, NOT used by production). The second account (avatar "A") has the REAL `stresscare-api` srv-dbeai2jrjlhs73f25dqg (stresscare-api-g0o1.onrender.com) and `stresscare-api-staging`. Edit env vars on the right account.
- Staging details: `.claude/docs/deployment.md` "Staging". Vercel MCP `edit_project_env` is blocked by the permission classifier unless the owner adds a rule.
- Branches are never deleted (owner leaves them; keep Tony, ian, master, tony_new, staging, redesign/site-v3).

## Owner's standing rules
- Branch before editing code. New, distinct work gets its own branch. Leaving a branch: commit, push, merge into `main`, never delete branches.
- Spawn subagents without asking (global `~/.claude/docs/subagents.md`). Builders only run `npm test` (server) and `npm run build` (client) and commit; the tester does sweeps and checks. Say "stop only what you started" in briefs (killing every `vite.js` can stop the owner's dev server). A brief that names one file gets only that file, so name every place.
- Every builder brief names the skills to load. UI: impeccable, emil-design-eng, apple-design, animate, mobile-native, plus figma-use, figma-generate-design, figma-design-to-code. Server: `code-quality.md`, and security-review for uploads.
- Design: Figma file `0TLnAGzZNbbFZxQU3C9U51` is the source. Light mode only until the team gives a dark palette. Navigation is never hidden: every nav item goes somewhere (a page with no frame opens a titled placeholder). Elements inside a drawn page (dialogs, add buttons, controls whose backend exists) are built from the shared primitives in the style of the drawn dialogs (rhythm 53:909, New reviewer 78:1272) and listed for a later Figma compare. Hide only controls with no backend at all.
- Motion: pages get animation, subtle sprites and shading, never clutter. Every UI brief has a "Motion and effects" section (guide `.claude/docs/motion.md`) and the tester checks it. The owner's Threads reference (@kopp morphing effect) needs a description or recording before it can be built.
- Docs: after each task put feature facts in the matching `.claude/docs/` file (CLAUDE.md only gets rules and pointers), tick items in `roadmap.md` only, and keep this file to state.
- No `Co-Authored-By` lines. Writing style: plain sentences, no em-dashes as connectors, no emojis in the UI (lucide-react).
- Owner decisions on record: AI-use notice stays in Terms and Privacy only (no strip in the reviewer UI; LEGAL bump comes with A1b); Subject page has a task tick box (ST1); files go on Cloudflare R2, free only (caps and per-student limits now live in plan 18, which replaces the old 100 MB / 10 MB numbers; see Storage below); chat reactions are native emoji; delete = sender or admin; no GIFs. Pe3 accepted differences are in roadmap J.

## Storage (2026-11-01, top priority)
- 2026-11-06 evening: bucket checked (private) and both Cloudflare tokens created in Chrome. Claude may not type secrets into Render, so the owner pastes `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CF_ANALYTICS_TOKEN` plus `R2_ACCOUNT_ID`, `R2_BUCKET`, `FILES_ALERT_EMAIL`, `FILES_ADMIN_EMAILS`, then `FILES_ENABLED=true`. Owner chose to do the rest of Cloudflare later (budget alert, 2FA, suspend staging).
- 2026-11-06: FS1 to FS3 merged into `main` (872 server tests). Files stay off until `FILES_ENABLED=true` plus R2 vars and `CF_ANALYTICS_TOKEN` are on production Render. Not yet run against real Cloudflare: do one live check at first switch-on. Under 5 users, no paid tier. Next: owner steps (bucket, tokens, env), TW-8b.
- Plan: `.claude/docs/revamp/18-free-file-storage-plan.md`. Render free + R2 free, $0 hard rule, our own server enforces the caps (Cloudflare has no spend cap, its alerts only email).
- Render workspace (second account) checked 2026-11-01: Hobby plan, no card, $0 invoices. Limits: 5 GB outbound, 750 instance hours, shared by `stresscare-api` and `stresscare-api-staging`. Over either one means suspension, not a bill. Usage on Nov 1 was 7 MB and 12.9 h.
- Owner added R2 to the Cloudflare account. Bucket, tokens and env vars are not done yet.
- Biggest Render bandwidth risk is notification polling (every 20 s, up to 100 items with avatars), not files. BW1 fixes it.
- Alternatives considered and rejected: Google Drive (no expiring links, one personal account, rate limits), disk on Hetzner (fine later), Hetzner VPS (about 300 pesos a month, Singapore location, only if Render's free limits bite).

## Behaviour notes worth keeping
- Task effort labels: up to 1.5h Small, up to 4h Medium, else Large.
- Snooze key `stresscare:checkin-snooze:<userId>:<kind>` holds `{since,count,until}`; dismissed moves use `stresscare:dismissed-moves:<userId>`. Home next-step order: check-in, bedtime nudge, move, tip, empty.
- Polling: shell `UnreadProvider` polls `GET /api/notifications` every 20s; `useTimetable` polls a stamp every 4s; `useReviewers` polls `/:id/status` every 4s only while a row processes.
- `WeekBars`: bars grey, today accent blue, heaviest day brown (heaviest wins if today is heaviest); key reads "Today" then "Heaviest". Not checked at 375px or in dark mode.
- Rhythm dialog sends studyHoursPerDay, sleepHours, usualSleepStart, usualWakeTime, travelMinutesPerDay, wellbeingGoal, hasRegularSleepSchedule:true. Pace: catch-up = Relaxed, steady = Balanced, high-performance = Intense.
- Practice: focus route `/study/reviewers/:id/practice?mode=all|weak[&new=1]`; `new=1` starts fresh and is dropped from the URL once started so F5 resumes; resume only if the open session mode matches; Exit and Esc keep the session open. Reviewer status chip: Making it, Didn't work, New, In progress, Done (last score 80%+).
- Plan switcher: extras are not counted in My week (chip says "Not in My week"); dot tones: main accent, shared good, extra watch. Phone switcher is a full-width row.
- Check-in route `/wellbeing/check-in/:kind` is a focus route (no sidebar). Header Check in goes there when due, else scrolls to `#feeling`. Wellbeing anchors `#load #feeling #sleep`.
- Hidden controls and why: each is hidden because it has no backend or no frame (list in roadmap J). Flashcards is a placeholder row at `/study/flashcards`.
- `ModalShell` renders through a portal into body (the sticky header's backdrop-filter trapped dialogs under the phone bottom bar). `ui-btn--sm::after` and `.ui-segment__option::after` give 44px hit areas, so 36px measurements on those are false positives.
- Below 1024px the phone layout and bottom bar apply. `useFocusView(active)` hides the bar for the phone chat. Skip link and focus: `useFocusMain`.
- Chat reactions and deletes (CH1): see `.claude/docs/social.md`. Owner's Pe1 notes: `markGroupRead(groupId)`.

## Gotchas
- Vite once cached an EMPTY `WeekBars.jsx` (blank Home, "does not provide an export named 'default'"); `touch`ing the file fixed it.
- The owner's Chrome may show no animations while Opera does: likely Windows "Animation effects" off (prefers-reduced-motion) or `localStorage['stresscare-motion']==='off'`. Not confirmed with the owner.
- Dev servers on 5000 and 5173 are the owner's; do not restart or kill them. They were once killed for low memory.
- Lint has known `set-state-in-effect` and `react-refresh` errors; leave them. Harness details: `.claude/docs/testing-and-gotchas.md`.
- Old code for logic only: `git show 1ad2c0d:<path>`. Notification links were repointed to the new paths in X1.
- Sample data in the owner's real Atlas account, all tagged "(sample)": subjects Data Structures IT201, Web Development IT202, Applied Statistics MATH203; 5 entries on main timetable "yeyeyeye"; 5 tasks. Removal is in roadmap K.
- Figma: tester sessions had no edit access to the old file key `rzpRwZFSbM1MjZRUgTY3Ok`; the current key is `0TLnAGzZNbbFZxQU3C9U51`. Friends sub-tab frames (Subtabs 125:210, counts hidden) are noted in design.md.

## Not verified yet (needs a human)
- Actual OS push alert: Chrome's permission prompt cannot be clicked by automation. Needs a real device and a second account.
- Phone: needs the deployed HTTPS site; on iPhone Add to Home Screen first.
- Web Push in production: nobody has confirmed `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` on Render. Without them the inbox works but phone and PC alerts stay off.
- Real Google sign-in and phone login on both live addresses.
- The consent form for the expert evaluation Google Form has placeholders and is not published.
