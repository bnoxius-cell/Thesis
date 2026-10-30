# StressCare build queue (2026-10-13)

The order to build everything that's left. Each `Q` section is a complete brief for one `builder` spawn: the main session spawns `builder` with "Build Q<n> from `build-queue.md`", waits for the report, reviews, merges, ticks the box here, then spawns the next one. Specs that already exist live in `system-review.md` (SR) or `.claude/docs/old-design/frontend-plan.md`; this file points at them and adds what they don't say.

Written by Opus after checking the code on 2026-10-13 (which SR items had quietly landed during the FE batches). Owner answers from the same day are recorded in `system-review.md` ("Owner decisions") and `.claude/docs/old-design/frontend-plan.md` section 8.

## How to run it (main session)
1. `main` clean and pushed. Spawn `builder` with: `Build Q<n> from build-queue.md. Branch: <branch>. Read that section and the files it points to. Stop only the processes you started.`
2. Items marked **Review** get a `code-reviewer` spawn on the branch before merging (CLAUDE.md requires it for anything auth or other users' data).
3. Merge, push, tick the boxes here and in `system-review.md` / `.claude/docs/old-design/frontend-plan.md`, move the report's docs notes into `.claude/docs/`, update `handout.md`.
4. One builder at a time in the main tree. The queue order matters where noted (Q1 before Q2, Q6 before Q10 and Q11).

## Rules every brief inherits (builders: read these)
- Branch from `main` with the name given. Commit on it, never merge or push.
- Server: tests in `server/tests/`, `npm test` in `server/` all green. Client: `npm run build` in `client/` passes, lint no worse than before.
- UI: read `mobile-rules.md` and `.claude/docs/design.md` first (build UI only from an approved Figma frame). Check 375px and 1280px, light and dark (`.claude/docs/testing-and-gotchas.md` has the UI harness and headless Chrome steps). Plain CSS on the role tokens, `Modal` for dialogs, `ConfirmDialog` for confirms, lucide icons, no emoji, no new packages.
- Never use ports 5000 or 5173 (the owner's dev servers on the real database). In-memory MongoDB on 5070.
- Copy follows the writing style rules: plain sentences, no em-dashes as connectors, warm but not cute.
- New data about a student (a new model or field that stores something they enter) means: list it in the Privacy Policy's "What we collect" (`client/src/pages/legal/legalContent.js`), bump `LEGAL_VERSION` (`server/utils/legal.js`) and `LEGAL_UPDATED`, and add the new collection to `server/scripts/deleteUser.js` (after Q6 lands).
- The report ends with a "Docs notes" list: what changed in behavior, for the main session to copy into `.claude/docs/`.

---

## Before the panel (must-have and should-have)

### Q1 `fix/auth-hardening` (Review) [ ]
SR Batch 1, with the owner's answers. Do every item in SR Batch 1 except S8 (moved to Q4), plus:
- **S6, neutral on reset only** (owner, 2026-10-13). `sendResetPasswordOtp`: an unknown email answers exactly like a known one, `{ success: true, message: 'If that email has an account, we sent a code.' }`, and sends nothing. Same answer, same status, roughly the same timing (don't skip the work so obviously that timing gives it away; at least don't return before a comparable await). The resend gap answer ("Wait a minute before asking for another code") only applies to real accounts, so for unknown emails just answer the neutral success. `resetPassword` on an unknown email answers the wrong-code message ("That code isn't right."), not "User not found". Login keeps "User not found".
- Client (`client/src/pages/authentication/AuthPage.jsx`, forgot flow around lines 160 to 215): show the server's message on success instead of the fixed "We sent a code to your email." toast, and handle the new answers ("Too many tries. Request a new code." sends the student back to the request step with the email kept; the wait-a-minute answer shows as an error and keeps the countdown).
- **S4, sign out other sessions on reset** (owner: yes). `passwordChangedAt` on the user, set to `Date.now() - 1000` in `resetPassword` (the second of slack stops a token issued in the same second from being rejected). `server/middleware/userAuth.js` loads `passwordChangedAt` (one `findById(...).select('passwordChangedAt').lean()`) and rejects a token whose `iat * 1000` is earlier. A deleted user's token is rejected too. Keep the current response shape (`res.json({ success: false, ... })`); Q2 changes it to a 401.
- Tests: everything SR Batch 1 lists, plus the neutral answer for an unknown email (no mail sent: spy the email service), `resetPassword` on an unknown email, and S4 (a cookie from before a reset is rejected, a login after it works).
- Not in scope: IP rate limiting (SR Batch 1 says why), the `nodemailer` upgrade.

### Q2 `fix/session-expiry` (Review) [ ]
SR Batch 5 (B6 server and client, P2), after Q1 (same middleware). Notes:
- Every reason `userAuth` rejects (no cookie, bad or expired token, token older than `passwordChangedAt`, user gone) answers 401 `{ success: false, code: 'session_expired', message: 'Your session ended. Please log in again.' }`.
- Grep the client for code that reads `success === false` from protected endpoints to decide it's logged out (`AuthContext` `getAuthState`, `RequireAuth`, the notification poll in `NotificationContext`, the schedule `stamp` poll in `Schedule.jsx`): an axios 401 now throws, so each must still end in a clean logged-out state, not a crash or an error toast loop.
- `/api/auth/is-auth` (or whatever the boot check calls) must not toast "session ended" on a normal first visit while logged out. Only toast when the person was logged in.
- Server tests that expect 200 for unauthenticated calls change to 401 (search `tests/` for `'Unauthorized'` and `jwt`).

### Q3 `fix/task-share-tags` [ ]
SR Batch 4 as written (B4 both parts, R8). The test it lists (import, edit, re-import still 409, chat still says added) is the acceptance check.

### Q4 `chore/deps-audit` [ ]
SR S8 minus the majors. `npm audit fix` (never `--force`) in `server/` and `client/`. Then `npm test`, `npm run build`, and a quick UI smoke at 375 and 1280 (sign in page, Today, Schedule, Study, People) since the client fix bumps `axios` and `react-router`. Report what's left and why (expected: `nodemailer` 10.x, a major, see Q14). Don't touch `package.json` ranges by hand beyond what `audit fix` writes.

### Q5 `chore/cleanup` [ ]
The rest of SR Batch 6, checked against the code on 2026-10-13 (B2, B3, B10, B11, B17 are already done):
1. **R6 remainder**: `Dashboard.jsx` no longer passes `isExamWeek`, but `computeWorkload` still takes it and `workload.js` lines ~219, 278, 295 still use it. Remove the parameter and its branches (exam pressure comes from `examInfo` only). Fix any test that passes it.
2. **R1, R2, R3**: delete `client/src/services/`, `client/src/interfaces/`, `client/README.md`; `npm uninstall rxjs tailwindcss autoprefixer postcss @types/react-router-dom` in `client/`. Check `vite.config.js` and any `postcss.config.*` / `tailwind.config.*` for references first.
3. **R4** (owner: delete): `server/controllers/wellbeingController.js` and `server/routes/wellbeingRoutes.js`. Confirm nothing imports them with a grep first.
4. **R11**: both `.env.example` files, as SR Batch 6 says. Variable names are in `.claude/docs/deployment.md`. Names and comments only, never values.
5. **R12**: the "✅ Added profileTag" comment in `userController.js`, "THE TAILWIND-STYLE WRAPPER" in `emailService.js`, and the "CORRECTED pre-save hook" comment in `userModel.js`. Leave the email colors.
6. **R10**: remove the unused CSS classes SR R10 lists, each only after a grep over `client/src` shows no use (class names can be built from strings, so also grep the stem, e.g. `particle`, `sched-share`).
7. **Legal hash**: `client/src/pages/legal/LegalPage.jsx` scrolls to `#section` when the page is opened with a hash (same pattern as `Wellbeing.jsx`'s `useEffect` on `hash`). UI rules apply (check on phone width that the sticky header doesn't cover the heading; use `scroll-margin-top` if it does).
8. **D4**: a real root `README.md`: what StressCare is (two sentences), stack, how to run it (`start.bat` or the `npm install` steps and `npm run dev`), that `.env` values come from a teammate, test and build commands, the live URL. No secrets, no team names (still a placeholder).

### Q6 `chore/delete-user-script` (Review) [ ]
SR Batch 10 (D3) as written. It deletes other people's shared data, so it gets a review. Also add a `npm run delete-user` script to `server/package.json`. Collections to cover are in SR Batch 10; check `server/models/` for anything newer (`completedAt` is just a field). Later batches that add a model extend this script.

### Q7 `perf/code-splitting` [x] (done in FE-2)
SR Batch 11 (P1) as written. Also report the before and after main chunk sizes.

---

## After the panel (or earlier if Q1 to Q7 finish early)

The four parked features the owner asked to plan (2026-10-13), plus follow-ups. Decisions behind them are in `.claude/docs/old-design/frontend-plan.md` section 8 Decided. UI rules apply to all of them.

### Q8 `feature/reviewer-ready-notification` [ ]
When an AI reviewer finishes in the background, tell the student, since generation takes a while and they've usually left the page.
- `notificationModel.js`: add `reviewer_ready` to `NOTIFICATION_TYPES`.
- `userModel.js` `notificationPrefs`: add `studyUpdates: { type: Boolean, default: true }`. `server/utils/notify.js` `PREF_BY_TYPE`: `reviewer_ready: 'studyUpdates'`. Wherever prefs are read and saved (`userController` or `notificationController`, and `NotificationPreferences.jsx`), add the toggle: label "Study", hint "When a reviewer you made is ready".
- `reviewerController.js`: where a generation run sets `status: 'ready'` (around line 179), call `notify` for the owner: title "Your reviewer is ready", message `"<title>" has <n> questions.`, link `/reviewers?r=<id>`, `dedupeKey: reviewer:<id>:v<version>`. When a run ends `failed` (around line 97, only when it was a real run, not a stale-job sweep that just restored the old version): title "Your reviewer couldn't be made", message with the plain error, same link, dedupe on the jobId. Targeted review finishing (around line 229): "New questions are ready" with the count. The notify call can't break the run (notify already swallows errors; keep it after the save).
- The inbox and push need nothing else (check that `Notifications.jsx` shows an icon for the new type; pick a lucide `BookOpen`).
- Tests in `reviewer.workflow.test.js` (or a new file): ready, failed and targeted each create one notification with the right link; `studyUpdates: false` suppresses them; a retried job that loses the race doesn't notify.

### Q9 `feature/chat-history` [ ]
"Load older messages" in group chat, plus the friendly schedule conflict (both from SR Known limits).
- Server, `groupController.js` `getMessages`: support `?before=<messageId>` returning up to 50 messages older than it, oldest first, and add `hasMore` (true when there are older ones; fetch 51 to know) to the initial and `before` answers. Bad id answers 404 like the rest. Polling with `after` is unchanged.
- Client, `GroupChat.jsx`: a "Load older messages" button at the top of the list when `hasMore`. Loading keeps the reader's place (store `scrollHeight - scrollTop` before, restore after the render). Merge by id like the poll does. The poll cursor must not move. Disabled while loading; an error shows inline with "try again", like the existing load error.
- Schedule conflict: in `scheduleController.js`, where a schedule is saved after edits, catch Mongoose's `VersionError` and answer 409 `{ success: false, message: 'Someone else just changed this schedule. Refresh and try again.' }`. Check that the schedule page shows that message (it toasts `data.message` on most calls; confirm for entry save and delete).
- Tests: `before` paging (3 pages of 120 messages, no duplicates, `hasMore` false at the end), non-member gets 404, the 409 on a forced version clash.

### Q10 `feature/breather` [ ]
A short guided breathing exercise, client only. Based on cyclic sighing (Balban et al., 2023, "Brief structured respiration practices enhance mood and reduce physiological arousal", *Cell Reports Medicine* 4(1)).
- `client/src/components/Breather.jsx`, opened in a `Modal`. Start screen: one line on what it is ("Two breaths in through your nose, then a long, slow breath out. A few minutes of this helps many people settle."), a `.segmented` choice of 1, 3 or 5 minutes (default 3), Start.
- Running: a circle that grows on the inhale (about 2s, then a short top-up of about 1s) and shrinks on the long exhale (about 6s), with the cue text under it ("Breathe in", "A little more", "Slowly out") and the time left. Timing from `Date.now()` against a start time, not counted intervals, so a busy tab doesn't drift. Pause and Stop. With `prefers-reduced-motion`, no scaling: the cue text and a plain progress bar only. The cue text is in an `aria-live="polite"` region, updated only on phase changes.
- End screen: "Nice. Take that calm with you." and Done. Nothing is saved, so no Privacy change.
- Where it's offered: (1) `CheckInResult.jsx`, when `highStress` is true, "One thing for today" gets a second line with a "Try a 3-minute breather" button that opens it (the existing text stays); (2) a small panel on `Wellbeing.jsx` after Check-ins, "Take a breather", one sentence and a button; (3) Me > Help and More, a "Breather" row. No streaks, no counts.
- Source line under the start screen in `--text-muted`, like the check-in citations: "Based on cyclic sighing (Balban et al., 2023)."
- Add the Wellbeing panel to `WELLBEING_TOUR` in `utils/tours.js` only if the tour lists every panel (check how it's written).
- Phone: the circle fits at 320px; the dialog is a bottom sheet if `Modal` does that on phones already.

### Q11 `feature/daily-checkin` (Review: new personal data) [ ]
One tap for mood and one for last night's sleep, on Today. Needs Q6 merged.
- Decided (Opus, delegated 2026-10-13, recorded in `.claude/docs/old-design/frontend-plan.md`): the daily check-in **does not change the workload score**. The score stays built on the two validated instruments (that's the thesis method). It feeds the sleep advice and one tip, and shows on Wellbeing. Mood is not a clinical measure and is never labelled as one.
- Model `server/models/dailyCheckInModel.js`: `user` (ref, required), `date` (`'YYYY-MM-DD'` in Philippine time, worked out on the server), `mood` (Number 1 to 5), `sleptHours` (Number 0 to 14, steps of 0.5, optional), timestamps. Unique index `{ user: 1, date: 1 }`.
- Routes on `surveyRoutes.js` (all `userAuth`): `PUT /api/surveys/daily` `{ mood, sleptHours }` upserts today's entry (validate both, 400 with a plain message on bad input; either can be sent alone, but at least one); `GET /api/surveys/daily?days=14` returns the caller's entries for the last N days (N 1 to 60, default 14), newest first. Owner only, from the token.
- Today (`Dashboard.jsx`): a compact card under the hero, "How are you today?" with five mood buttons (lucide faces are fine: `Frown`, `Annoyed`, `Meh`, `Smile`, `Laugh`, each with a text label for screen readers and a visible short word under it: "Rough", "Low", "Okay", "Good", "Great") and "Last night I slept" with a small stepper or select (3 to 12 hours, half steps). Saving is instant on tap with a quiet "Saved" state; the card collapses to one line ("Today: Good, 6.5h of sleep. Change") once both are in. Hidden while the setup checklist shows. Don't push Today's main content below the fold on a phone: keep the card short.
- Sleep advice: in `sleepPlan.js` / `buildTips` (`workload.js`), when last night's `sleptHours` is at least 1.5 hours under the student's target, add one tip: "Short night" / "You slept about Xh last night. Aim for bed by <time> tonight." using the bedtime the existing sleep plan already works out. Pure function change, with a test in `sleepPlan.test.js` or `workload.guidance.test.js`.
- Wellbeing: in the Sleep panel, the last 7 days as a simple row (day initial, hours, mood word), plain text and CSS, no chart library. Empty state: one line inviting the first check-in on Today.
- Privacy Policy: add "daily mood and hours slept, if you log them" to "What we collect", bump `LEGAL_VERSION` and `LEGAL_UPDATED`. Add the collection to `server/scripts/deleteUser.js` and its test.
- Tests: new `daily.test.js` (upsert twice on the same day keeps one row, validation, `days` window, can't read another user's).

### Q12 `feature/focus-timer` [ ]
A 25 or 50 minute focus timer tied to one task, counting time done against the hours estimate.
- Decided (Opus, delegated 2026-10-13): focus time is **shown, not scored**. The workload score keeps using the task's estimated hours, so the formula doesn't change.
- Server: `taskModel` `focusMinutes: { type: Number, default: 0, min: 0 }`. `POST /api/tasks/:id/focus` `{ minutes }`: owner only (404 otherwise, bad id 404), `minutes` an integer 1 to 120, adds with `$inc`, returns the task. Tests in a new `task.focus.test.js`.
- Client: a "Focus" action on open tasks in the Schedule Tasks tab (`components/schedule/TasksTab.jsx`) and on Today's due-soon items. It opens a `Modal` to pick 25 or 50 minutes and Start, then closes and leaves a timer pill. The timer state (`taskId`, `title`, `startedAt`, `minutes`, `pausedAt`, `pausedTotal`) lives in localStorage (try/catch) and a small context so it survives navigation and reloads, and the time left is worked out from `Date.now()`. One timer at a time; starting another asks with `ConfirmDialog`.
- The pill: fixed bottom-right on desktop, above the bottom bar on phones (respect the safe area and the page Guide button: check they don't overlap), showing the task title (truncated) and time left, with Pause and Stop. Stop asks "Save the X minutes you did?" (Save, Discard). When time's up: a toast "Time's up. Nice work on <title>.", saves the minutes, and the tab title shows "Done" until focused. A browser notification is not in scope.
- Display: task cards show "1.5 of 3h done" when `focusMinutes > 0`, as plain muted text.
- Privacy Policy: add "time you log with the focus timer" to the tasks line, bump `LEGAL_VERSION` and `LEGAL_UPDATED` (if Q11 bumped it and `main` hasn't been deployed since, say so in the report so the main session can decide on one bump).

### Q13 `feature/reviewer-exam-link` [ ]
Link a reviewer to an exam on the schedule, so the exam reminder on Today points at the right reviewer.
- Server: `reviewerModel` `exam: { scheduleId: ObjectId, entryId: ObjectId, title: String, date: String }`, default unset. `PATCH /api/reviewers/:id/exam` `{ scheduleId, entryId }` (or `null` to unlink): owner of the reviewer only; the schedule must be one the student can view (use `loadSchedule` / `roleOf`), the entry must exist and be `kind: 'exam'`; store a snapshot of its title and date so a later deleted entry degrades to just the stored text. `GET` responses include `exam`.
- Client, the reviewer view (`components/reviewer/`): "Exam: none. Link to an exam" opens a small `Modal` listing upcoming exam entries from the student's schedules (the data the schedule page already loads; reuse its fetch). Shows the linked exam's title and date with Change and Unlink.
- Today: where the next exam shows (`today-exam-note` and the exam tips), when a reviewer is linked to that exam, add a link "Open reviewer" to `/reviewers?r=<id>`. Fetch the reviewer list once (it's already small); don't add a request per exam.
- Tests: link, unlink, entry not an exam (400), schedule the student can't see (404), someone else's reviewer (404).
- Still parked after this: weak topics on Wellbeing, sharing a reviewer to a group.

### Q14 `chore/mail-and-tests` [ ]
- **nodemailer 10**: upgrade, read its changelog for breaking changes against `server/utils/emailService.js`, run the tests. Report that a real email (sign up code and reset code) must be tried by the owner before the next deploy; the main session doesn't push `main` until the owner confirms.
- **Controller tests** (`todo.md` Backend): add coverage for the task controller (create, update with the S7 checks, delete, bad ids), the user controller (`updateProfile` limits, `getUserData`), and the notification controller (list, mark read, mark all, prefs). Look at what `server.checks.test.js`, `task.completed.test.js` and `notifications.test.js` already cover first and only fill the gaps.

---

## Not planned (on purpose)
- IP rate limiting (SR Batch 1 explains why the per-account limits are the real fix).
- Splitting `App.css` into files, Taglish copy, sharing a reviewer to a group, weak topics on Wellbeing: still parked in `.claude/docs/old-design/frontend-plan.md` section 13.
- Anything in `.claude/docs/old-design/frontend-plan.md` "Considered and rejected".
- Owner-only items (placeholders, real phone pass, real Google sign-in, push on Render): in `handout.md`.
