# Roadmap

This file is the only place for open work. Tick items here and do not copy them into other files. State, rules and gotchas live in `handout.md`. Plan files hold the detail for a batch; this file holds the order and the status.

Plans: `.claude/docs/revamp/15-parity-first-plan.md` (parity, account and trust, new features), `16-chat-attachments-reactions-plan.md` (chat extras), `17-navigation-and-feedback-plan.md` (navigation and feedback), `.claude/docs/priority-2-redesign-backlog.md` (older leftovers). Team feedback list: `docs/KNOWN_ISSUES.md` (shared, tick boxes there as fixes merge).

## E. Storage (TOP PRIORITY, owner 2026-11-01: ship storage asap, free only)
Status: planned, plan finalized 2026-11-06 (Revision 3, O1 to O11 answered, under 5 users, no paid tier before the thesis). Plan: `.claude/docs/plans/18-free-file-storage-plan.md` (Revision 3 block at the top; replaces the FS0 spec in plan 16). FS1 to FS3 are merged to `main` (off until configured; env flag `FILES_DEV_MEMORY=true` for local dev only). Next: owner steps, then TW-8b. See `next-prompt.md`. Decision: stay on Render free + Cloudflare R2 free, no paying, no Hetzner for now (Hetzner VPS in Singapore is the upgrade path if Render's limits bite). Uploads go through our server; downloads use 60 s presigned R2 links; every R2 call is reserved against caps in Mongo. Letters stay as they are so references like "needs E" still work.
Owner steps (no Claude usage):
- [x] Cloudflare account with R2 added (free tier, no charge unless over limits)
- [x] Private R2 bucket `stresscare-files` (exists, private, checked 2026-11-06)
- [~] Both tokens created 2026-11-06 (`stresscare-files-rw`, `stresscare-analytics-read`, expire 2027-11-06, 1 year, not 06-30). Secrets were never saved: if the Cloudflare tabs were closed, roll both tokens and make new ones. Still to do: $1 budget alert, 2FA. Original item: R2 API token: Object Read and Write, that one bucket only; second read-only Account Analytics token for the reconciliation job; expiry 2027-06-30; $1 budget alert; 2FA (click path in plan 18 section 5)
- [x] 2026-11-06: both tokens rolled, R2 vars and `FILES_ENABLED=true` saved by the owner on production Render srv-dbeai2jrjlhs73f25dqg, `production` released at a062b5e (FS1 to FS3 live, deploy up, no startup errors). `FILES_RESUME_KEY` left unset on purpose (optional).
- [ ] Live check of file storage at first use: confirm the 10-minute Cloudflare analytics reconcile ran without a `[files]` pause or alert email, then one real upload and read in the app
- [x] `stresscare-api-staging` suspended 2026-11-06 (Render shows Suspended 1). Still the owner's: pause the staging monitor in UptimeRobot (not signed in on Claude's Chrome); production pinged 24/7 uses 744 of the 750 free instance hours
- [ ] Answer plan 18 questions O1 to O11 (defaults apply until answered), and check the Render Billing page weekly
Build order (efficiency order agreed 2026-11-01; one builder at a time, `/clear` after each batch, builders run only build and `npm test`):
- [ ] REPLACED 2026-11-06 by plan 19 (`.claude/docs/plans/19-study-subject-files-plan.md`, O1 to O10 accepted): Study hub, Subject tabs (Overview, Tasks, Reviewers, Files), general Files page with folders, Practice page (Reviewers | Flashcards). SF0, SF1, SF2 DONE and merged to main 5eb48de; SF3 DONE and merged to main 89834ed (tester-passed 2026-11-06, not released). Order: SF0 tag and branch, SF1 then SF2 (server, no frames needed), SF3 (Subject tabs, code only), draw Figma F1 to F12 (owner approves), then SP1, SF4, SF5, SF6. Don't release to production before SF4. Replaces plan 18's TW-8b batch.
- [~] Figma frames F1 to F12 (plan 19; 2026-11-06: owner APPROVED F12 and F1 to F3 desktop; F1 to F3 phone, F4 to F11 desktop+phone, footer and flashcards study screens all DRAWN, OWNER APPROVED ALL 2026-11-06, build now (SP1, SF4 to SF6, footer), node ids in design.md "Storage / Files"): Files page, subject Files tab, move picker, upload with progress and Cancel, paused state, empty states, Practice page; phone and desktop, light only; owner approves before SP1, SF4, SF5, SF6
- [x] BW1 `fix/api-bandwidth` (merged to main, live) (builder-sonnet medium): small unread-count endpoint, gzip, slower chat polling, group lists every 60 s (do first; can run beside the Figma work)
- [x] (done 2026-11-06, merged to main, tester + code-reviewer passed, 872 tests; files stay off until the owner steps) FS0a content checks (builder-sonnet high), FS0b config, kill switch, signing (builder-sonnet high), FS0c call counter and cleanup (builder-opus high), FS0d upload and download helpers plus usage page (builder-sonnet high), FS0e Cloudflare reconciliation job (builder-opus medium); all on `feature/file-store-foundation` after tag `pre-chat-files`
- [~] Storage UI from the approved frames: SP1 DONE and merged (db750da), SF4 DONE and merged (685bc21, tester + code-reviewer passed). SF5 DONE and merged (4fccca2, tester + code-reviewer passed). SF6 DONE and merged (44735d9). Then footer, flashcards study screen, release (owner says when)
- [x] One code-reviewer and security-review pass on the whole branch, then merge (merged; release to production not done, harmless while files are off)
- [ ] Then CH4 chat uploads, TW-9 source picker
- [ ] TW-9 scope (owner 2026-11-07): New reviewer is not just "upload". Add a source choice: Upload a PDF, or Choose from my files (the picker lists the student's PDFs from Files, any place). Reviewers stay separate from files; no merge. Server reads the stored file's text, so no re-upload. Optional later: "Make a reviewer" on a PDF row in Files, and a source-file chip on reviewer rows. Needs a dialog frame or a note that it follows the New reviewer frame 78:1272
Right after the storage items:
- [~] Site footer: drawn and APPROVED 2026-11-06 (Terms, Privacy, About, Help; desktop 164:3243, phone 164:3376), ready to build

## A. Wrap up what is built
Status: Pe3 to Pe5 are merged and live. Production is efffd91 (Pe5, plus the bandwidth fix). `fix/tasks-empty-main` is still unmerged.
- [x] Browser check `fix/tasks-empty-main` at 375 and 1280 (empty Tasks view, no logout toast): tester passed 3 of 3 on main fb22f97, 2026-11-06. Its two commits (26c5063, 1287134) were already in `main`
- [~] Tag `pre-nav-feedback` (plan 17, B0): the tag already exists but sits at 010a540 (the roadmap docs commit), not the current tip. Move it to `main` only if the owner wants
- [x] Spawn the tester on Pe3 (`feature/people-friends`): two accounts, accept, decline, cancel and remove, badges clear in the sidebar, People tab and bottom bar, `?add=1` focus, 375 and 1280, profile states
- [x] Fix what the tester finds, merge `feature/people-friends` into `main`
- [x] Release: `git branch -f production main && git push origin production` (tester pass first; never merge `staging`)
- [ ] Reconcile the two handout copies (done by the roadmap commit: handout.md is now the slim state file)
- [ ] Delete `next-prompt.md` once the owner confirms (its task is covered by sections A, C and D)

## L. Animation pass (owner notes 2026-11-06)
Status: not started. Owner: the sidebar's animation is good now, keep that level everywhere. Use the animate skill and `.claude/docs/motion.md`; subtle, behind `prefers-reduced-motion`.
- [ ] Study page: switching Subjects and Reviewers tabs makes the body jump, because the Subjects tab has the "pick up where you left off" card. Animate it so the change is smooth (no layout jump)
- [ ] Add more animation across the whole system, matching the sidebar's level (planner or `find-animation-opportunities` first to pick the places)

## B. Navigation and feedback (plan 17)
Status: planned, nothing built. One builder at a time, tester after each, then release.
Owner decisions to confirm (defaults in brackets; the plan uses them until answered):
- [x] O1 (owner 2026-11-06: "maybe yes") Draw the detail and feedback dialogs in Figma first: lean yes, draw them with the F-frames; ask again if it blocks NV1
- [x] O2 (default) Build NV4 right after NV3: yes
- [x] O3 Feedback email: idevadrian@gmail.com. Owner step: set `FEEDBACK_EMAIL` on production Render srv-dbeai2jrjlhs73f25dqg when FB1 ships (Claude may not paste env values into Render)
- [x] O4 (owner: "yes") Keep feedback after account deletion. FB1 must then store it without a link to the account (drop the user id on deletion) and the Privacy text must say so; confirm with the owner when FB1 is briefed
- [x] O5 (owner: "now") Bump the legal version in FB2
- [x] O6 (owner: "no") No rating question
- [x] O7 (owner: "now") Widen the exam-to-subject title match now (add it to NV3, planner to say how loose)
Batches:
- [ ] NV0 server notes and links: `notes` in the week overview, `taskLink()` for reminders (builder-haiku)
- [ ] NV1 shared `ItemDetailDialog` in `features/details/` plus Home rows (builder-sonnet high)
- [ ] NV2 Plan Week blocks, phone agenda and Tasks rows, with `?task=` and `?day=` scroll and flash (builder-sonnet high)
- [ ] NV3 Subject "Next up" rows and search results (builder-sonnet medium)
- [ ] NV4 edit and delete a task in the dialog, Notes field in the task form (builder-sonnet high; optional, see O2)
- [ ] FB1 `POST /api/feedback`, `feedbacks` collection, limits, `USER_DATA` entry, code-reviewer (builder-sonnet medium)
- [ ] FB2 feedback dialog from the avatar menu, Privacy lines, `LEGAL_VERSION` and `LEGAL_UPDATED` bump (builder-sonnet medium)
- [ ] Tester after each batch, then release (workflow in handout.md)
- [ ] L1 to L4 later items listed in plan 17

## C. Finish People
Status: Pe1 to Pe5 done, tested and live (2026-11-06).
- [x] Pe4 Group Info dialog, Edit name, Pin a note (frame 64:910, builder-sonnet medium)
- [x] Pe5 New group and Join a group dialogs; wire `onNewGroup` and `onJoinGroup` into `PeopleAddMenu` and `GroupsEmpty`, remove the "hidden until Pe5" gap and the empty-Groups copy that points at missing buttons

## D. Figma frames (FG1)
Status: not drawn. Ask the owner quick-answer design questions first, record node ids and answers in `.claude/docs/design.md`, owner approves before anything is built. Use figma-use and figma-generate-design, light only, name frames `<Page> / <size> / light / <state>`, reuse the Components page.
- [ ] Notifications: desktop drawer and phone sheet
- [ ] Me: Profile, Settings, Privacy and Help, desktop and phone
- [ ] About
- [ ] Delete my account dialog (in Me Privacy)
- [ ] Owner approval of the Friends sub-tab frames (Friends 66:452, Requests 115:922, Pending 115:1091, phone 67:1017, 116:1105, 116:1234) and empty Friends 66:1130; no phone empty-Friends frame exists
- [ ] Frames for chat extras (section H) and Canvas (section I)

## F. Build the drawn pages
Status: waits on D (and E for anything with files).
- [ ] N1 Notifications drawer and phone sheet (inbox, preferences, push UI)
- [ ] M1, M2, M3 Me: Profile, Settings, Privacy and Help (M3 adds a second feedback entry point)
- [ ] AB1 About (team names are an owner placeholder, see K)

## G. Account and trust
Status: not started. Plan 15 Phase 2.
- [ ] W1a auth hardening (sameSite still none/strict, no verified check in `userAuth`; new 401/403 answers can break client `data.success` checks)
- [ ] A1a account deletion, server (must call `pullUserReactions`; touches other students' shared data)
- [ ] A1b account deletion, UI and legal text
- [ ] Legal bump: once if A1b lands the same week as FB2
- [ ] Admin accounts and admin view (scope undecided: ask what admins can do and how they sign in; Figma first; code-reviewer pass)
- [ ] "Talk to someone" line in Help (owner decision; verify the hotline number before use)
- [ ] Other short validated check-ins (sleep, burnout) beside PSS-10 and WHO-5
- [ ] Terms accept prompt and legal pages scrolling to `#section`, if still missing in the new shell
- [ ] System-review Batch 1 (forgot password, neutral wording on reset only) and the rest of `system-review.md` server and security items

## H. Chat extras (plan 16)
Status: CH1 done. Server batches may run before the UI.
- [ ] CH2 share timetable entry and subject card (builder-sonnet medium)
- [ ] CH3 reviewer card (builder-sonnet high)
- [ ] FS0 file store (builder-opus high, code-reviewer, security-review; needs E)
- [ ] CH4 uploads (builder-opus high, same reviews)
- [ ] Figma frames F1 to F10 (list in plan 16 section 5)
- [ ] CH5, CH6, CH7 chat UI after the frames

## I. New study features (plan 15 Phase 3, then Phase 4)
Status: none built. Subjects (TW-1) exist.
- [ ] TW-8a links per subject, TW-8b files per subject (needs E), TW-9 source picker (needs 8b)
- [ ] TW-14 Canvas connect (blocked on the OLFU token check and the classmate's feed host; fallback is a calendar feed URL; frames still to draw: Add subject hint, renewal chip, phone Home row, Join and "Add meeting link" on class rows; copy Canvas row frame 27:229 into the main file; spec `revamp/13-canvas-connect-card.md`; the class form should expose `meetingUrl`)
- [ ] TW-15 Canvas courses, announcements, syllabus
- [ ] TW-2 focus timer, TW-3 notes, TW-4 reviewer as document, editor and export
- [ ] TW-5 flashcards (sidebar row is a placeholder), TW-6 study blocks, TW-7 weekly digest
- [ ] TW-10 quiz types, TW-11 calendar upgrades, TW-12 global search and palette, TW-13 archive subjects and term templates
- [ ] Phase 4 leftovers per plan 15
- [ ] Phones (720px and under) have no way to reach search; Home date subtitle hidden there
- [ ] Canvas card on Home: placeholder row or wait (decide with TW-14)
- [ ] Parked reviewer items: "reviewer ready" notification, exam link, sharing a reviewer to a group

## J. Small open items
Status: none blocking. Group by page when batching.
Server and data
- [ ] `lastMessage` on `GET /api/groups` so group rows show a preview, not "N members" (small server batch)
- [ ] `deleteGroup`, `leaveGroup`, `joinGroup` answer 200 `success:false` for non-members (should be 404)
- [ ] Two tabs adding the same timetable duplicate entries (server does not dedupe)
- [ ] Confirm Render's Node is 20+ (pinned in `server/package.json`)
People and groups
- [ ] A left group stays in the list until refresh
- [ ] Pe3 to Pe5 smells: `people-friends.css` is 320 lines; Info dialog has no family-friendly control (server PATCH supports it); no group icon picker in New group; Info notification option is "Tasks only" not "Mentions only"; Segment stays disabled with no message if preferences fail; two quick Create calls in one tick can make two groups; also `people-friends.css` is 312 lines, `.people-avatar` lives in `people.css`; accepted differences to revisit: row line is "Code XXXXXX", empty Friends keeps the Add a friend card, profile has no phone frame, sent-request profile has no Cancel
Shell and Home
- [ ] Avatar menu: shadow Shadow/3 (0 12 32 .12), dividers inset 8px, icons 20px at x+16, item padding 8/10
- [ ] Header title y30 on Study, Subject, Reviewer vs y26 on Home; desktop "+" y24, subtitle y62, cards from y106
- [ ] Sidebar: first nav row y66, logo x16 y20, eyebrow block, bottom padding 20; collapsed rail check
- [ ] Phone header: tools on one 44px row, long greetings max 2 lines (no Home phone frame)
- [ ] Home hero: Join button 44h px20 with class-time chip; hero Join untested with a class today
- [ ] Home spacing: 24 gaps, progress track 8px, week bars 24px in a 216px box, heading letter-spacing 0, search 40px
- [ ] "Plan for you" cards not clickable (covered by NV1); Next step buttons stack at 1280 (card 230 vs frame 272); after Later on PSS the WHO-5 prompt shows at once
- [ ] Press scale and drag-over lift still instant under reduced motion (`bottombar.css:90`)
- [ ] Notch: header `top:-16px` leaves 4px of bell hit area in the safe area (`shell.css:25`); bottom bar height 65px duplicated in `bottombar.css` and `layout.css`; inactive tab colour a shade lighter than frame
- [ ] Legal-prose links ~19px tall on phones; `Modal` always draws X when given a `title` (maybe add `closable`)
Plan
- [ ] Day buttons 35 and 43px wide at 320 and 375, Month cells 41px at 320 (7 columns cannot reach 44)
- [ ] `plan.css` ~511 lines (split); `home/TodayRows.jsx` and `plan/JoinLink.jsx` duplicate the Join anchor
- [ ] Week grid times read "8:00 – 10:00 am"; task meta has no due time; "My week" select and Filter hidden in Month and Tasks; Month and Tasks read only the student's own plan
- [ ] A deleted or unshared timetable stays in the switcher until reload; `Menu` and `SelectButton` cannot render rich rows
Wellbeing and check-ins
- [ ] `wellbeing.css` 445 lines (split); Why rows share one icon and show up to 4; day labels run from today; note wording "not a measure of your stress" in `weekReading.js`
- [ ] No Edit on rhythm in the empty hero, no "Add a class" button there; Cancel in the rhythm dialog drops edits without asking; no way to switch off a regular sleep schedule; Enter does not submit
- [ ] W2: owner OK on result words (Low, Moderate, High stress; Doing okay, Feeling a bit low, A hard stretch), WHO-5 copy and "What this changes" rows; no Exit confirm; "Not now" does not count as Home's Later; no better or worse line; no Move it on on the result
- [ ] `useCheckInResult.js` imports `sleepSummary` from wellbeing; tips-fallback path untested
Study
- [ ] Empty Study step-pill gap 16px (frame says 8, check); reviewer progress bar radius (frame 4px)
- [ ] Subject Next-up capped at 5 rows (`NextUpList.jsx` MAX_ROWS) so a same-day exam can be cut; rows taller than frame; exam and class match only by title = subject name or code
- [ ] Practice column jumps up 56px when feedback shows; feedback screen scrolls on phones under 700px tall; focus-screen layout duplicated in `practice.css` and check-in css
- [ ] Exit uses replace so Back after Exit shows the reviewer twice; "Reviewer not found" Back points at the missing reviewer; sidebar highlight for `/study/reviewers/:id`; delete dialog focuses the destructive button; failed reviewer has no retry
- [ ] Long unbroken subject name breaks mid-word at 320px (`shell.css`); `study-failed` duplicates `home-failed`; New subject dialog compare with Figma
- [ ] Hidden controls to build when their backend or frame exists: reviewer Share, Make flashcards, Download PDF, Edit text, Rename, New questions, Targeted, header search pill, paste notes, question types, exam chip, Skip, subject Notes, Materials and Practice tabs, Add meeting link, Active and Archived segment, End this term, Resume row (needs `openSession` on the list)
Cleanup
- [ ] Z1 delete the old `App.css` rules and legacy `.task-check`, `check-pop`, `.toast-with-action` in `styles/components.css`; `.app-boot` too
- [ ] Z2 fixes pass; `useTaskDone.js:21` lint error and `useCheckInPrompt.js` lint warning; `AuthContext.jsx:11` repeats `backendUrl`
- [ ] 1:1 Figma audits still owed: Wellbeing, Plan, and a numeric re-measure of Shell, Home and Study (tester needs Figma edit access to `rzpRwZFSbM1MjZRUgTY3Ok` or the current file)
- [ ] Sync Figma sign-in frame 6:2 with the code (icons in fields, note position, hover) after owner approval
- [ ] Offer a pass over the other 44 success toasts (owner: toasts feel AI-made)
- [ ] Docs notes to write: server.md (TermsGate path, legal page routes), design.md (shell, 256px sidebar, 1120px content, sidebar from 1024px), notifications.md (shell polling, `markGroupRead`), motion.md (sliding pill, badge pop-in)
- [ ] Ask the owner what they moved by accident in Figma; whether to install the `break-ui` skill (repo `emilkowalski/skills`)

## K. Owner and thesis tasks
Status: owner-side items; Claude cannot do these.
- [ ] Fill `client/src/utils/helpContacts.js` and the About team names (visible placeholders; never invent them)
- [ ] Real phone check and real Google sign-in on stresscare.xyz and on the vercel.app link; email login sticks on a phone
- [ ] Check VAPID keys are set on Render (production srv-dbeai2jrjlhs73f25dqg); re-enable web push on the new origin; real OS push test (second account posts in a shared group while the tab is in the background)
- [ ] Manual reviewer tests at the end of `reviewer-report.md` (live upload, real phone, scanned and password-protected PDFs, several students at once, a subject expert checking answers)
- [ ] Try a real reviewer upload in production
- [ ] Publish the consent form (placeholders: investigator, adviser, duration, researcher contacts)
- [ ] Thesis core waiting on experts: W2, W3, re-evaluation
- [ ] Delete the "(sample)" data from the owner's Atlas account when done (subjects, 5 timetable entries, 5 tasks)
- [ ] Paste the Messenger "high school level" feedback into `docs/KNOWN_ISSUES.md`
- [ ] Re-link `client/.vercel/project.json` to `stresscare` (`vercel link`) before any manual CLI deploy
- [ ] Delete `wellbeingController.js` and `wellbeingRoutes.js` (owner said yes 2026-10-13)
- [ ] Add tests for the Task, User and Notification controllers; there are no client tests
- [ ] If billing is ever linked to the Gemini key, soften the Privacy Policy line about Google using the text (the Google AI Pro subscription does not count)
- [ ] Staging leftovers: one test sign-up, new `JWT_SECRET` on the staging Render service, decide on a separate Brevo key, optionally rotate secrets pasted in chat
- [ ] Remove the now-unused production `VITE_BACKEND_URL` (builds ignore it)
- [ ] Branches are never deleted by Claude; the owner cleans them up
