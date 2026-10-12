# StressCare system review (2026-10-12)

A full read of the server and client, looking for bugs, broken features, security gaps and redundant code. Nothing was changed in the app while reviewing. The second half of this file is a work list written for Sonnet to pick up.

## How it was checked
- Read every file in `server/` (controllers, models, routes, utils, middleware, config) and `client/src/` (pages, components, contexts, utils), plus `vercel.json`, `render.yaml`, the service worker and the legal text.
- `npm test` in `server/`: **375 of 375 pass** (22 files, 54s).
- `npx eslint .` in `client/`: **20 errors, 4 warnings**. 19 are the `react-hooks/set-state-in-effect` pattern CLAUDE.md already calls known; one is real (see P2).
- `npx vite build`: **builds**, but as one 628 KB JS chunk (183 KB gzipped) with a 139 KB logo SVG.
- `npm audit --omit=dev`: server 5 issues (1 critical `proxy-addr`, 1 high `nodemailer`, 2 moderate, 1 low), client 5 (2 high, 3 moderate).
- Not done: no browser or phone testing in this pass, no load testing.

## What's in good shape
- Server tests are broad and green, and they run against an in-memory database.
- The AI reviewer pipeline is careful: untrusted Gemini output is cleaned, grading happens on the server, retries and stale jobs are handled.
- Schedule access control goes through one place (`loadSchedule` / `roleOf`), and it's tested.
- `notify()` can never break the request that triggered it.
- Pictures are size and format checked on the server, not just in the browser.

## Summary

| Area | High | Medium | Low |
|---|---|---|---|
| Security | 1 (S1) | 3 (S2, S3, S5) | 4 (S4, S6, S7, S8) |
| Bugs and broken features | 1 (B1) | 6 (B2 to B7) | 10 (B8 to B17) |
| Redundant or dead code | | | 13 (R1 to R13) |
| Docs and legal drift | | 2 (D2, D3) | 2 (D1, D4) |
| Performance and build | | | 2 (P1, P2) |

---

# Findings

## Security

### S1 (High). Password reset and email codes can be guessed
`server/controllers/authController.js` (`resetPassword` around line 332, `verifyEmail` around line 253). A 6-digit code stays valid for 20 minutes and there's no limit on wrong guesses, and no rate limiting anywhere in the server. `/api/auth/send-reset-otp` and `/api/auth/reset-password` need no login, so anyone who knows a student's email can request a code and keep guessing it. That's a real path to taking over an account. Codes also come from `Math.random()` (`server/utils/generateOtp.js`), and the server doesn't enforce the 180-second resend cooldown the client shows, so a script can also flood someone's inbox.

### S2 (Medium). An unverified email account can be claimed before its real owner signs in with Google
`googleLogin` in `authController.js` (around lines 172 to 178). If someone signs up with a `@student.fatima.edu.ph` address they don't own (email and password, never verified), and the real student later uses Google sign-in, the code links Google to that account and marks it verified, but keeps the password the first person set. That person can now log in as the real student.

### S3 (Medium). Removed group members can rejoin without the code
`joinGroup` in `server/controllers/groupController.js` (around lines 147 to 157) accepts `{ groupId }` as well as `{ joinCode }`. The app only ever sends the code. A member who was removed still has the group id (it's on the "You were removed" notification), so one API call puts them straight back in. Removing someone doesn't really work.

### S4 (Low). Sessions survive a password reset
JWTs have no version or "issued before password change" check, so a 30-day cookie stolen or left on a shared computer still works after the password is reset.

### S5 (Medium, for the thesis data). Check-in scores are taken from the browser as-is
`server/controllers/surveyController.js` saves whatever `score` the browser sends and never looks at `responses` (count, range). The PSS-10 and WHO-5 results are thesis data, so the server should work the score out itself from the answers.

### S6 (Low, owner's call). Login and reset say whether an email has an account
"User not found" on login and reset tells a stranger which emails are registered. Common in small apps; changing it is the owner's decision.

### S7 (Low). Missing limits on some inputs
Tasks have no length limits on title, course or description (`taskModel.js`). `updateTask` skips the checks `createTask` does (hours, difficulty, importance, date), and `title.trim()` on a non-string throws a 500. `updateProfile` accepts any name, program, `studyHoursPerDay` and `sleepHours` (negative or huge numbers reach the workload maths).

### S8 (Low). Dependency advisories
`npm audit` shows 5 issues on each side. Most fix with a plain `npm audit fix`. The server's `nodemailer` fix is a major version (10.x), so it needs a check that sending still works.

## Bugs and broken features

### B1 (High). There's no "Forgot password" in the app
The server has `send-reset-otp` and `reset-password` (and tests for them), but `AuthPage.jsx` has no link or screen for it. A student who forgets their password has no way back in. Also on the server: `resetPassword` doesn't enforce the 8-character minimum that sign-up does, and if the "password changed" email fails, the student is told the reset failed even though the password did change.

### B2 (Medium). The Settings theme buttons can flip the theme the wrong way
`client/src/pages/Settings.jsx` (lines 38 to 51): both "Light" and "Dark" call `toggleTheme`, so tapping the one that's already on switches to the other. The same page still says "Your tasks and profile are stored locally in your browser. No data is sent to external servers", which is false (already on the CLAUDE.md to-do), and uses emoji in the buttons, against the no-emoji UI rule.

### B3 (Medium, needs the owner). The well-being goal does the opposite of what its tip says
`client/src/utils/workload.js` (line 263 and the tips at lines 520 to 521). "High performance" adds +10 to the score, which makes warnings come *sooner*, but its tip says "the score allows a heavier load before it warns you". "Catch up" subtracts 10 and is described as gentler. One of the two (the numbers or the words) is wrong.

### B4 (Medium). Editing a task gives it a new share tag every time
`updateTask` in `server/controllers/taskController.js` (around lines 225 to 245) makes a new share template whenever any detail field is in the request. The task edit forms always send every field, and "Move it" on the dashboard changes the date, so nearly every save re-tags the task. Effects:
- A classmate who added your shared task and then edits their copy gets a new tag, so the group chat offers "Add to my schedule" again and the "You already have this task" check (409) no longer catches the duplicate.
- The `taskShares` collection grows by one document per edit, forever.

### B5 (Medium). Task reminders fire against 8:00 AM, not the end of the due day
Due dates are stored as midnight UTC of the picked day, which is 8:00 AM in the Philippines. `server/utils/reminders.js` measures the lead time from that, so "due in less than 24 hours" arrives at 8:00 AM the day *before*, the 3-hour option fires at 5:00 AM on the due day, and nothing fires after 8:00 AM on the due day.

### B6 (Medium). An expired session isn't noticed
`server/middleware/userAuth.js` answers a missing or expired token with HTTP 200 and `{ success: false, message: 'jwt expired' }`. The client has no response interceptor, so after the cookie expires (1 day without "remember me") every page shows errors or "jwt expired" toasts while still looking signed in, until a full reload.

### B7 (Medium). Dialogs close by accident, and most ignore Escape
There are 24 hand-built dialogs (`className="modal-overlay"` with `onClick={onClose}`), and no shared modal component.
- Selecting text inside a field and letting go of the mouse outside the dialog closes it and throws away what was typed (the click lands on the overlay).
- Only `ConfirmDialog`, `MemberDialog` and `UploadReviewerDialog` close on Escape (the Rename schedule one on the to-do list is one of many).
- A stray tap outside the PSS-10 or WHO-5 check-in loses every answer.
- No focus handling: focus doesn't move into the dialog or come back after.

### B8 (Low). Friend requests can't be declined or cancelled
`server/controllers/friendController.js` and `client/src/pages/Friends.jsx`. Incoming requests only have "Accept", so unwanted ones sit there forever. Sent requests aren't listed and can't be withdrawn. If B already sent A a request and A tries to add B, A is told "Friend request already sent" instead of the two becoming friends. The add-friend dialog isn't a form, so Enter doesn't send it.

### B9 (Low). The Friends button decorations never show
`Friends.jsx` (around line 139) gives the particles Tailwind class names (`left-12 top-0 text-red-300`), but Tailwind isn't wired up and the CSS animates `.particle-1/2/3`, so they stay at `opacity: 0`.

### B10 (Low). Saving your profile fails silently
`client/src/pages/Profile.jsx` (`handleSave`, around line 102): a server error (bio over 200 characters, say) only goes to the console, success shows nothing, and a changed name doesn't update the sidebar until reload (it never calls `getUserData`).

### B11 (Low). Dashboard task actions fail silently
`client/src/pages/Dashboard.jsx` (`updateTask` and `handleDeleteTask`, around lines 346 to 377) only log errors. "Move it" shows "Moved ... Undo" even when the save failed.

### B12 (Low). A down holiday service slows every dashboard load
`server/utils/holidays.js` only caches successes. When Nager.Date is down, every `/api/schedules/week` call waits up to 8 seconds for it again.

### B13 (Low). Two schedule actions notify before they save
`shareWithFriend` and `joinByCode` in `server/controllers/scheduleController.js` send the notification and then call `schedule.save()`. If the save fails, people are told about something that didn't happen (the rest of the file is careful to do it the other way round).

### B14 (Low). Bad ids and odd input give raw 500 errors
`removeFriend`, `acceptFriendRequest`, `leaveGroup`, `deleteGroup`, `updateTask`, `deleteTask` don't check that ids are valid ObjectIds, so a bad id becomes a Mongoose CastError text. `cleanEntry` in the schedule controller throws if `days` isn't an array. Most controllers (outside reviewers) send `error.message` straight to the student.

### B15 (Low). Dark mode leaves light surfaces
`client/src/index.css` gives `body` a light background with a red tint, and nothing sets `color-scheme`, so in dark mode the page edges (iPhone overscroll), native date and time pickers and selects stay light. The theme class is added by React after first paint, so dark-mode users see a light flash on every load.

### B16 (Low). Deprecated Mongoose option
`{ new: true }` in `userController.updateProfile` and `notificationController.markAsRead` prints deprecation warnings in the test run. Mongoose wants `returnDocument: 'after'`.

### B17 (Low, already on the to-do). Still open from 2026-10-11
The dashboard "Next exam" pill wraps into narrow columns at 375px (`.today-exam-note`). B7 covers the Rename-dialog Escape item.

## Redundant or dead code

- **R1.** `client/src/services/auth.service.ts` and `client/src/interfaces/user.interface.ts` are never imported. They describe a localStorage bearer-token login the app doesn't use and call `/api/auth/profile`, which doesn't exist. They're the only reason `rxjs` is installed.
- **R2.** Unused client dependencies: `rxjs`, `tailwindcss`, `autoprefixer`, `postcss` (Tailwind was never wired up), and `@types/react-router-dom` (types for v5, the app uses v6).
- **R3.** Unused files: `client/src/assets/hero.png`, `react.svg`, `vite.svg`, `client/public/favicon.svg`, `client/public/icons.svg`, and the Vite boilerplate `client/README.md`.
- **R4.** `server/controllers/wellbeingController.js` and `server/routes/wellbeingRoutes.js`: still dead (nothing imports them). Already on the to-do.
- **R5.** Dead model fields: `group.recentMessages` (chat lives in `groupMessage`), `user.friends` (friendships live in the `Friend` collection; `getUserData` populates an array that is always empty), Friend status `'blocked'` (never set), notification type `group_invite` (never sent), `task.group` (never set). Also `hasRegularSleepSchedule`, `usualSleepStart` and `usualWakeTime`: the Profile page collects them but nothing uses them (see D2).
- **R6.** `isExamWeek` on the dashboard is hardcoded `false`, and its branches in `workload.js` are dead now that real exams from the schedule drive exam pressure.
- **R7.** Dashboard and Profile each fetch `/api/user/data` again although `AuthContext` already has it, with their own defaults (Dashboard assumes 8h sleep, the server default is 7).
- **R8.** `getTasks` runs `ensureShareTemplateForTask` on every task on every load (one extra query per task, on every dashboard and schedule visit) to backfill tasks from before share templates existed.
- **R9.** `ensureMainSchedule` and the reviewer `expireStale` run extra queries on most requests. Fine at this size, just worth knowing.
- **R10.** About 15 CSS classes in `App.css` aren't used anywhere: `eyebrow-mark`, `range-value`, `insight-dot`, `btn-icon`, `chat-avatar-fallback`, `sched-look`, `sched-share-section`, `sched-share-add`, `sched-people`, `sched-person-name`, `sched-code-row`, `sched-role-select`, `particle-1/2/3`.
- **R11.** The `.env.example` files are stale: `server/.env.example` is missing `BREVO_API_KEY` and the `VAPID_*` keys and says `NODE_ENV=production`; `client/.env.example` says `VITE_BACKEND_URL` is the Render URL, but production uses the Vercel URL through the proxy.
- **R12.** Leftover comments and copy: "Assuming you create this file" (`Header.jsx`), "✅ Added profileTag" (`userController.js`), "THE TAILWIND-STYLE WRAPPER" and a blue accent that isn't the brand color in `emailService.js`.
- **R13.** Two toast systems: react-toastify everywhere, plus home-made `.success-toast` / `.error-toast` on the Friends page (which also shows the same error twice).

## Docs and legal drift

- **D1 (Low).** The CLAUDE.md to-do "stray 'keep the first demo loop clear for the panel' line in AuthPage" is already fixed (commit `5d593b4`). Ticked in CLAUDE.md as part of this review.
- **D2 (Medium).** The Privacy Policy's "What we collect" doesn't mention sleep hours, bedtime, wake time or travel time, which the Profile page collects and stores. Either list them (and decide whether to bump `LEGAL_VERSION`) or stop collecting the three unused ones (R5).
- **D3 (Medium).** The Privacy Policy promises to delete an account and its data on request, but there's no tool for it. Deleting the user document by hand in Atlas would leave their tasks, schedules, messages, owned groups, notifications, surveys and reviewers behind.
- **D4 (Low).** The root `README.md` is one line.

## Performance and build

- **P1 (Low).** One 628 KB JS bundle (183 KB gzipped) for every page, plus a 139 KB `logo.svg` used as favicon, header and footer logo. Slow on a phone on mobile data.
- **P2 (Low).** `AuthContext.jsx` line 9 sets `axios.defaults.withCredentials = true` inside the component, on every render (a lint error). It belongs at module level. The other 19 lint errors are the known setState-in-effect pattern; lint can't be used as a check until they're dealt with.

## Known limits (not bugs, just worth knowing)
- Group chat only loads the latest 50 messages; there's no "load older".
- Two editors saving the same schedule at the same moment can get a Mongoose version error (a 500) instead of last-write-wins.
- The daily AI limit is check-then-insert, so two uploads in the same instant can both pass.
- The Terms prompt is enforced in the browser only.

---

# Work list for Sonnet

## Rules for every task
1. At the start of a session, read `CLAUDE.md` and `handout.md`. Before any UI change, read `mobile-rules.md`: every UI change is also done for phones in the same change (320, 375, 768, 1280px, light and dark).
2. One branch per batch below, using the branch name given. Follow the git rules in the global CLAUDE.md (no `Co-Authored-By` or `Claude-Session` lines; when moving to the next batch, commit, push and merge the finished one into `main`; never delete branches).
3. Server changes: add or update tests in `server/tests/`, and `npm test` in `server/` must pass. Client changes: `npx vite build` in `client/` must pass and lint must not get worse.
4. Never start test servers on port 5000 (the owner's real dev server). Use an in-memory MongoDB on another port, like 5070 (see `handout.md`, Gotchas).
5. Batches marked **Opus review** touch auth or security. Stop before merging and ask the owner to have Opus review the diff.
6. Items marked **Ask the owner first** need a decision. Ask in one short question, then continue with the rest.
7. UI work follows `frontend-plan.md` (added 2026-10-12). Don't ask design questions beyond its Open list. Don't spawn subagents without asking.
8. Tick the boxes here as items are done, and add a line to CLAUDE.md for anything that changes how the app behaves.
9. **Order**: `frontend-plan.md` section 9 merges these batches with the frontend revamp over the next 3 weeks. Batch 9 is done inside FE-1; B2, B3, B10, B11, B17 and R6 from Batch 6 inside FE-2 and FE-4; Batch 8's UI inside FE-4; Batch 2, R5 and D2 inside FE-5. Don't do those twice. Must-have before the panel: Batches 1, 2, 3, 7.

## Owner decisions to collect first
- [x] **B3** (answered 2026-10-12, wellbeing first): "Lighter pace" (`catch-up`) warns sooner (+10), "Balanced pace" (`steady`) unchanged, "Fuller pace" (`high-performance`) tolerates more (-10) only while the fresh check-ins aren't strained. Labels, hints and steps in `frontend-plan.md` section 8 and FE-4 step 1b, which replaces the B3 step in Batch 6.
- [x] **R5 / D2** (answered 2026-10-12): keep the sleep fields and use them (bedtime suggestion, `frontend-plan.md` section 7.2); list them, travel time, task completion times and check-in history in the Privacy Policy and bump `LEGAL_VERSION` (FE-5 step 5).
- [ ] **S6**: keep "User not found" on login and reset, or switch to a neutral "If that email has an account, we sent a code"? Recommended: neutral wording on reset only.

## Batch 1: `fix/auth-hardening` (Opus review)
- [ ] **S1** Limit wrong codes.
  - In `server/models/userModel.js` add `verifyEmailAttempts` and `resetPasswordAttempts` (Number, default 0) and `lastOtpSentAt` (Date).
  - In `authController.js`: reset the matching counter whenever a new code is issued. On a wrong code, increment it; on the 5th wrong try, clear the code and answer "Too many tries. Request a new code." A correct code resets the counter.
  - Enforce a 60-second gap between code emails per account in `issueVerifyOtp` and `sendResetPasswordOtp` (answer with a plain "Wait a minute before asking for another code").
  - Change `server/utils/generateOtp.js` to `crypto.randomInt(100000, 1000000)`.
  - Don't add IP rate limiting in this batch: behind the Vercel proxy and Render, `req.ip` is either shared by everyone or spoofable unless `trust proxy` is set exactly right. The per-account limits are the real fix.
  - Tests in `server/tests/auth.otp.test.js`: 5 wrong codes lock the code, a fresh code works again, the resend gap is enforced.
- [ ] **S2** In `googleLogin`, when linking to an existing account that is **not** verified, replace its password with a new random hash and clear the OTP fields before marking it verified. Test in `auth.google.test.js`: an unverified local account linked by Google can no longer log in with the old password.
- [ ] **B1 (server part)** In `resetPassword`, require at least 8 characters (reuse the rule from `validateRegisterFields`), and wrap `sendPasswordResetSuccessEmail` in try/catch so a mail failure is logged and the response still says the password changed. Tests.
- [ ] **S4 (optional, ask the owner if it's worth one extra DB read per request)** Add `passwordChangedAt` to the user, set it in `resetPassword`, and in `userAuth` reject tokens whose `iat` is older.
- [ ] **S8** Run `npm audit fix` (no `--force`) in `server/` and `client/`, then `npm test` and `npx vite build`. Leave the `nodemailer` major upgrade for a separate change, and note it in CLAUDE.md.

## Batch 2: `feature/forgot-password` (UI, mobile rules apply)
- [ ] **B1** In `client/src/pages/authentication/AuthPage.jsx` add a "Forgot password?" link under the password field on the login form. Flow: enter email, then call `POST /api/auth/send-reset-otp`; then a step with the same 6-box code input used for verification, a new password field with the show/hide eye, and a confirm field; submit calls `POST /api/auth/reset-password { email, otp, password }`. On success, show a toast and go back to the login form with the email filled in. Respect the server's resend gap with the same countdown the verify step uses. Note on the step that Google accounts sign in with Google. Check at 320 and 375px, light and dark.

## Batch 3: `fix/server-checks`
- [x] **S3** In `joinGroup`, remove the `groupId` branch so a join code is required. Test in `group.roles.test.js`: a removed member posting `{ groupId }` gets "Group not found" and isn't added.
- [x] **S5** Create `server/utils/surveyScoring.js` with `scorePSS(responses)` (10 integers 0 to 4; items 4, 5, 7, 8 reversed as `4 - x`) and `scoreWHO(responses)` (5 integers 0 to 5; sum times 4). In `surveyController.js`, reject bad `responses` with a 400, ignore the browser's `score` and save the computed one. Keep sending `score` from the client (harmless). New test file `survey.test.js` covering both scales, reversal and bad input. The modals already score the same way, so nothing changes for students.
- [x] **S7** Task limits: add `maxlength` to `taskModel` (title 120, course 80, description 1000) and validate updates in `updateTask` with the same checks as `getTaskPayload` (only for fields present). Profile: in `updateProfile`, trim and limit name (60) and program (80), and clamp or reject `studyHoursPerDay` (1 to 12), `sleepHours` (4 to 12) and `travelMinutesPerDay` (0 to 240). Tests.
- [x] **B5** In `server/utils/reminders.js`, treat a task as due at 23:59 Philippine time on its due day (`dueDate` midnight UTC plus 15h59m). Use that time both in the query window and in the lead-time check; keep the dedupe key on the stored `dueDate`. Test in `notifications.test.js` with a fixed `now`.
- [x] **B12** In `server/utils/holidays.js`, remember a failure for 10 minutes (throw the cached error straight away), and share one in-flight request per year so parallel calls don't each hit Nager. Test with the existing mock seam.
- [x] **B13** In `shareWithFriend` and `joinByCode`, call `schedule.save()` first and notify after it.
- [x] **B14** Return 404 for invalid ObjectIds in `removeFriend`, `acceptFriendRequest`, `leaveGroup`, `deleteGroup`, `updateTask`, `deleteTask`. In `cleanEntry`, treat a non-array `days` as missing. For 500s in task, friend and group controllers, log the error and send a plain message like the reviewer controller's `serverError`.
- [x] **B16** Replace `{ new: true }` with `{ returnDocument: 'after' }` in `userController.updateProfile` and `notificationController.markAsRead`.

## Batch 4: `fix/task-share-tags`
- [ ] **B4** In `updateTask`, compare each detail field with the task's current value and only make a new share template when something actually changed (dates compared by time value).
- [ ] **B4** Add `sourceTag` (String) to `taskModel`. Set it in `importTaskByTag` and in `createTask` when a code was used. Use "`shareTag` or `sourceTag` matches" in `importTaskByTag` (the 409), in `getTaskByTag` (`alreadyAdded`) and in `serializeMessages` in `groupController.js` (`addedByMe`). Test: import a task, edit it, then importing the same tag again still answers 409 and the chat still says it's added.
- [ ] **R8** In `getTasks`, only call `ensureShareTemplateForTask` for tasks that have no `shareTag`.

## Batch 5: `fix/session-expiry` (Opus review)
- [ ] **B6** In `server/middleware/userAuth.js`, answer a missing or bad token with HTTP 401 and `{ success: false, code: 'session_expired', message: 'Your session ended. Please log in again.' }` instead of 200, without leaking the JWT library's message. Update `middleware.userAuth.test.js` and any other tests that expect 200.
- [ ] **B6** In `AuthContext.jsx`, add an axios response interceptor once (at module level, or in an effect with cleanup): on a 401 with `code === 'session_expired'` from anything except `/api/auth/*`, set `isLoggedin` false, clear `userData`, and show one toast (use a fixed `toastId` so polling doesn't stack them). `RequireAuth` then sends the person to login with `state.from`, so they land back where they were. Check that the notification poll and the schedule `stamp` poll stop cleanly.
- [ ] **P2** Move `axios.defaults.withCredentials = true` out of the component to the top of `client/src/main.jsx`.

## Batch 6: `fix/client-quick-wins` (UI, mobile rules apply)
- [ ] **B2** In `ThemeContext.jsx` expose `setTheme`. In `Settings.jsx`, have the Light and Dark buttons set their own theme, add `aria-pressed`, swap the emoji for lucide `Sun` and `Moon` icons, and replace the "stored locally" paragraph with an accurate one ("Your account, tasks, schedules and check-ins are stored on StressCare's server so they're there on any device. See the Privacy Policy for what we keep and who can see it.") with a link to `/privacy-policy`. Remove "Data management (coming soon)" and the disabled export button, or leave them if the owner wants export later.
- [ ] **B3** Apply the owner's decision in `workload.js` (`goal` and the two tips), update `server/tests/workload.guidance.test.js` and the "Workload score" section of CLAUDE.md.
- [ ] **B10** In `Profile.jsx` `handleSave`: show `data.message` (or a plain error) in a toast on failure, a success toast on save, and call `getUserData()` after a successful save so the sidebar name updates.
- [ ] **B11** In `Dashboard.jsx`, make `updateTask` and `handleDeleteTask` return whether they worked and toast an error when they didn't. Only show the "Moved ... Undo" toast after a successful move.
- [ ] **B17** Fix the `.today-exam-note` wrap at 375px (let the text wrap as one block next to the icon instead of becoming columns).
- [ ] **R6** Remove `isExamWeek` from `Dashboard.jsx` and the `isExamWeek` parameter and branches from `computeWorkload` and `buildTips` in `workload.js`. Update tests that pass it.
- [ ] **R1, R2, R3** Delete `client/src/services/`, `client/src/interfaces/`, the unused assets in R3 and `client/README.md`, then `npm uninstall rxjs tailwindcss autoprefixer postcss @types/react-router-dom` in `client/`. Update the Stack line in CLAUDE.md (Tailwind is gone). Build must pass.
- [ ] **R4** Delete `server/controllers/wellbeingController.js` and `server/routes/wellbeingRoutes.js` (nothing imports them, checked 2026-10-12). Tick the matching CLAUDE.md to-do and remove the paragraph about them from Notes.
- [ ] **R11** Bring both `.env.example` files in line with the env var list in CLAUDE.md (server: add `BREVO_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, set `NODE_ENV=development`; client: explain that local dev uses `http://localhost:5000` and production uses the Vercel URL through the `/api` proxy).
- [ ] **R12** Remove the leftover comments listed in R12. Leave the email template colors unless the owner asks.

## Batch 7: `feature/shared-modal` (UI, mobile rules apply)
- [x] **B7** Build `client/src/components/Modal.jsx`:
  - Props: `open`, `onClose`, `labelledBy`, `busy` (blocks closing), `className`, `children`, and optional `confirmClose` (a function that returns true when closing should ask first).
  - Closes on Escape (unless `busy`, and only the top-most modal when several are open), and on an overlay click only when the press *started* on the overlay too (track `onMouseDown`/`onPointerDown` target), which fixes the drag-select bug.
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; moves focus to the first field (or the dialog) on open and back to the opener on close; keeps Tab inside the dialog; locks page scroll while open.
  - Reuses the existing `.modal-overlay` / `.modal-content` styles, so nothing looks different.
- [x] **B7** Switch every dialog to it, one file at a time, checking each still works: `ConfirmDialog`, `TaskBoard` (edit), `TaskImportDialog`, `PSSSurveyModal`, `WHOSurveyModal`, `Friends` (add), `Groups` (create, join), `GroupChat` (share picker), `MemberDialog`, `GroupSettingsDialog`, `UploadReviewerDialog`, the three in `ReviewerView`, and in `components/schedule/`: `EntryModal`, `EntryDetails`, `TaskModal`, `DayMarkModal`, `ShareModal`, `ScheduleImportDialog`, plus Rename, Create and Join in `Schedule.jsx`. `TermsGate` stays as it is (it must not close).
- [x] **B7** For the PSS-10 and WHO-5 check-ins, pass `confirmClose` so that closing with answers started asks "Leave the check-in? Your answers so far won't be saved." (use `ConfirmDialog`).
- [x] **B7** Tick the "Rename schedule dialog doesn't close on Escape" to-do in CLAUDE.md and add a line under "Dialogs and the page Guide": new dialogs use `Modal`.

## Batch 8: `feature/friend-requests` (server and UI; good to combine with the Friends redesign on the to-do)
- [ ] **B8 server** Add `DELETE /api/friends/request/:requestId` (the receiver declines or the sender cancels a pending request, nobody else) and `GET /api/friends/sent` (pending requests you sent). In `sendFriendRequest`, if the other person already sent you a pending request, accept it and notify them instead of answering "already sent". First tests for the friend controller in a new `friends.test.js`: send, accept, decline, cancel, mutual request, bad ids.
- [ ] **B8 UI** On `Friends.jsx`: a Decline button next to Accept, a "Sent" list with Cancel, the add-friend dialog as a real `<form>` (Enter sends), toasts through react-toastify instead of `.success-toast` / `.error-toast` (R13), and the error shown once.
- [ ] **B9** Use the `particle-1/2/3` classes on the three particles (or remove them if the redesign drops the button).
- [ ] Decide with the owner whether friends' emails should still show on friend cards and requests (group member lists and public profiles already hide email).

## Batch 9: `fix/dark-mode-surfaces` (UI, mobile rules apply)
- [ ] **B15** In `client/index.html`, add a tiny inline script before the app loads that reads `localStorage['stresscare-theme']` (inside try/catch) and adds `dark-theme` to `<html>`, so there's no light flash.
- [ ] **B15** In `App.css`, set `color-scheme: light` on `:root` and `color-scheme: dark` on `.dark-theme`, and give `body` `background: var(--bg-app)`. Remove the hard-coded light background and red gradient from `index.css` (or move the gradient onto a token that has a dark version). Check the date and time pickers in the schedule forms in dark mode.

## Batch 10: `chore/delete-user-script`
- [ ] **D3** Add `server/scripts/deleteUser.js` (`npm run delete-user -- someone@example.com`). It prints what it would remove and only deletes with `--yes`. It removes the user and everything tied to them: tasks, task share templates they created, owned schedules, their entries in other schedules' `collaborators`, group messages they sent, groups they own (deleted along with their messages; members notified with `notify`) and their membership and admin entries in other groups, friendships, notifications sent to them, push subscriptions, PSS and WHO responses, reviewers and attempts, and AI request rows. Test it against the in-memory database (`server/tests/deleteUser.test.js`) by calling an exported function, not the CLI. Document it in CLAUDE.md next to the Privacy Policy notes.

## Batch 11: `perf/code-splitting`
- [ ] **P1** In `client/src/App.jsx`, load the pages with `React.lazy` and one `Suspense` fallback that matches the existing boot message (keep `AuthPage` and `Dashboard` in the main bundle since most visits start there). Shrink `client/src/assets/logo.svg` (run it through SVGO or export a small PNG for the favicon and header). Confirm the 500 KB build warning is gone and the deep links (`?s=`, `?g=`, `?r=`, `?code=`) still work after a reload.

## Later, only if the owner wants
- [ ] **R5** Remove the dead model fields once the owner decides on the sleep fields (Batch 6 or its own small branch).
- [ ] **R10** Remove the unused CSS classes during the page-by-page redesign.
- [ ] **D4** A real `README.md` (what StressCare is, how to run it, where the docs are).
- [ ] "Load older messages" in group chat, and turning the schedule version error into a friendly "Someone else just changed this, try again" (see Known limits).
