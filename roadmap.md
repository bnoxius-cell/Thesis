# Roadmap

The only place for open work. One list, top to bottom is the priority order. Tick items here and don't copy them into other files. State, rules and gotchas live in `handout.md`. Plan files hold the detail for a batch; this file holds the order and the status.

Each item starts with a tag. The letter is the old section, kept so references like "needs E" still work. `J` items carry the page they belong to, so they can be batched.

| Tag | Area | | Tag | Area |
|---|---|---|---|---|
| E | Storage (top priority) | | F | Build the drawn pages |
| A | Wrap up what is built | | G | Account and trust |
| B | Navigation and feedback | | H | Chat extras |
| C | Finish People | | I | New study features |
| D | Figma frames | | J | Small open items |
| | | | K | Owner and thesis tasks |

Plans (in `.claude/docs/plans/`): `15-parity-first-plan.md` (parity, account and trust, new features), `16-chat-attachments-reactions-plan.md` (chat extras), `17-navigation-and-feedback-plan.md` (navigation and feedback), `18-free-file-storage-plan.md` (storage, Revision 2 block first; replaces the FS0 spec in plan 16). Older leftovers: `.claude/docs/revamp/priority-2-redesign-backlog.md`. Team feedback list: `docs/KNOWN_ISSUES.md` (shared, tick boxes there as fixes merge).

Where things stand: storage is planned and FS0a to FS0d are built on `feature/file-store-foundation`. Decision: stay on Render free + Cloudflare R2 free, no paying, no Hetzner for now (a Hetzner VPS in Singapore is the upgrade path if Render's limits bite). Uploads go through our server; downloads use 60 s presigned R2 links; every R2 call is reserved against caps in Mongo. The Tasks fix and Pe3 are built but not merged. Production is bb80e13 (Pe2). Navigation and feedback (B) is planned, nothing built; one builder at a time, tester after each, then release. Figma frames (D) are not drawn: ask the owner quick-answer design questions first, record node ids and answers in `.claude/docs/design.md`, owner approves before anything is built. Use figma-use and figma-generate-design, light only, name frames `<Page> / <size> / light / <state>`, reuse the Components page.

## The list

- [x] **E** Cloudflare account with R2 added (free tier, no charge unless over limits)
- [x] **E** Private R2 bucket `stresscare-files` (created 2026-11-01, Standard, public access disabled)
- [ ] **E** R2 API token: Object Read and Write, that one bucket only; second read-only Account Analytics token for the reconciliation job; expiry 2027-06-30; $1 budget alert; 2FA (click path in plan 18 section 5)
- [ ] **E** Set the R2 env vars, `FILES_ENABLED`, caps and `FILES_RESUME_KEY` on production Render srv-dbeai2jrjlhs73f25dqg (never the owner's Gmail-account service)
- [ ] **E** Suspend `stresscare-api-staging` and stop pinging it (production pinged 24/7 uses 744 of the 750 free instance hours; past 750 Render suspends everything)
- [ ] **E** Answer plan 18 questions O1 to O11 (defaults apply until answered), and check the Render Billing page weekly
- [ ] **E** Figma frames for the first storage surface (default: files per subject, TW-8b; chat attachments CH4 later): upload and attach, file row and card, "uploads paused" state, owner usage page; phone and desktop, light only; owner approves before any UI builder
- [x] **E** BW1 `fix/api-bandwidth`: tester passed, merged into `main` and pushed 2026-11-01 (not released to `production` yet; tag `pre-chat-files` is on that merge)
- [ ] **E** FS0 on `feature/file-store-foundation` (build order: one builder at a time, `/clear` after each batch, builders run only build and `npm test`). Done and tester-passed: FS0a 7deeba8 (+fixes 03e84f7), FS0b c370aea, FS0c 7acf4ab. FS0d f23d372 (tester PASSED, 830 tests; not run: production-mode links with files off, FILES_ENABLED=true with missing R2 vars). Next: FS0e Cloudflare reconciliation job (builder-opus medium), needs the Cloudflare analytics token design from plan 18 section 3.14. Final-review notes: guard test would not catch a bulk delete via another verb; HTML named .txt accepted (safe as attachment); docx with embedded OLE not scanned; `removeRow` logs object key (not a link)
- [ ] **E** Storage UI from the approved frames (builder-sonnet), tester at 375 and 1280
- [ ] **E** One code-reviewer and security-review pass on the whole branch, then merge and release
- [ ] **E** Then CH4 chat uploads, TW-9 source picker
- [ ] **E** Site footer: one item (owner to say what goes in it; default Terms, Privacy, About and Help links; draw in Figma first, phone and desktop, light only)
- [ ] **A** Browser check `fix/tasks-empty-main` at 375 and 1280 (empty Tasks view, no logout toast), then merge it into `main`
- [ ] **A** Tag `pre-nav-feedback` on `main` after that merge (plan 17, B0)
- [ ] **A** Spawn the tester on Pe3 (`feature/people-friends`): two accounts, accept, decline, cancel and remove, badges clear in the sidebar, People tab and bottom bar, `?add=1` focus, 375 and 1280, profile states
- [ ] **A** Fix what the tester finds, merge `feature/people-friends` into `main`
- [ ] **A** Release: `git branch -f production main && git push origin production` (tester pass first; never merge `staging`)
- [x] **A** Reconcile the two handout copies (done by the roadmap commit: handout.md is now the slim state file)
- [ ] **A** Delete `next-prompt.md` once the owner confirms (its task is covered by this list)
- [ ] **B** O1 Draw the detail and feedback dialogs in Figma first? [No, build from primitives in the style of 53:909 and 78:1272, list for a later compare]
- [ ] **B** O2 Build NV4, edit and delete a task from the dialog? [Yes, right after NV3]
- [ ] **B** O3 Feedback email address [owner gives one; set `FEEDBACK_EMAIL` on production Render srv-dbeai2jrjlhs73f25dqg; until then feedback is only stored]
- [ ] **B** O4 Keep feedback after account deletion? [Delete it with the account]
- [ ] **B** O5 Legal bump timing [bump now in FB2; if A1b is ready the same week, bump once for both]
- [ ] **B** O6 Rating question in feedback? [No for now]
- [ ] **B** O7 Widen the exam-to-subject title match? [Later; exam dialog shows "See it in Plan" until then]
- [ ] **B** NV0 server notes and links: `notes` in the week overview, `taskLink()` for reminders (builder-haiku)
- [ ] **B** NV1 shared `ItemDetailDialog` in `features/details/` plus Home rows (builder-sonnet high)
- [ ] **B** NV2 Plan Week blocks, phone agenda and Tasks rows, with `?task=` and `?day=` scroll and flash (builder-sonnet high)
- [ ] **B** NV3 Subject "Next up" rows and search results (builder-sonnet medium)
- [ ] **B** NV4 edit and delete a task in the dialog, Notes field in the task form (builder-sonnet high; optional, see O2)
- [ ] **B** FB1 `POST /api/feedback`, `feedbacks` collection, limits, `USER_DATA` entry, code-reviewer (builder-sonnet medium)
- [ ] **B** FB2 feedback dialog from the avatar menu, Privacy lines, `LEGAL_VERSION` and `LEGAL_UPDATED` bump (builder-sonnet medium)
- [ ] **B** Tester after each batch, then release (workflow in handout.md)
- [ ] **B** L1 to L4 later items listed in plan 17
- [ ] **C** Pe4 Group Info dialog, Edit name, Pin a note (frame 64:910, builder-sonnet medium). Pe1 to Pe3 are built (Pe3 untested, see A)
- [ ] **C** Pe5 New group and Join a group dialogs; wire `onNewGroup` and `onJoinGroup` into `PeopleAddMenu` and `GroupsEmpty`, remove the "hidden until Pe5" gap and the empty-Groups copy that points at missing buttons
- [ ] **D** Notifications: desktop drawer and phone sheet
- [ ] **D** Me: Profile, Settings, Privacy and Help, desktop and phone
- [ ] **D** About
- [ ] **D** Delete my account dialog (in Me Privacy)
- [ ] **D** Owner approval of the Friends sub-tab frames (Friends 66:452, Requests 115:922, Pending 115:1091, phone 67:1017, 116:1105, 116:1234) and empty Friends 66:1130; no phone empty-Friends frame exists
- [ ] **D** Frames for chat extras (H) and Canvas (I)
- [ ] **F** N1 Notifications drawer and phone sheet (inbox, preferences, push UI). Waits on D
- [ ] **F** M1, M2, M3 Me: Profile, Settings, Privacy and Help (M3 adds a second feedback entry point)
- [ ] **F** AB1 About (team names are an owner placeholder, see K)
- [ ] **G** W1a auth hardening (sameSite still none/strict, no verified check in `userAuth`; new 401/403 answers can break client `data.success` checks). Plan 15 Phase 2
- [ ] **G** A1a account deletion, server (must call `pullUserReactions`; touches other students' shared data)
- [ ] **G** A1b account deletion, UI and legal text
- [ ] **G** Legal bump: once if A1b lands the same week as FB2
- [ ] **G** Admin accounts and admin view (scope undecided: ask what admins can do and how they sign in; Figma first; code-reviewer pass)
- [ ] **G** "Talk to someone" line in Help (owner decision; verify the hotline number before use)
- [ ] **G** Other short validated check-ins (sleep, burnout) beside PSS-10 and WHO-5
- [ ] **G** Terms accept prompt and legal pages scrolling to `#section`, if still missing in the new shell
- [ ] **G** System-review Batch 1 (forgot password, neutral wording on reset only) and the rest of `docs/system-review.md` server and security items
- [ ] **H** CH2 share timetable entry and subject card (builder-sonnet medium). CH1 is done; server batches may run before the UI
- [ ] **H** CH3 reviewer card (builder-sonnet high)
- [ ] **H** FS0 file store (builder-opus high, code-reviewer, security-review; needs E)
- [ ] **H** CH4 uploads (builder-opus high, same reviews)
- [ ] **H** Figma frames F1 to F10 (list in plan 16 section 5)
- [ ] **H** CH5, CH6, CH7 chat UI after the frames
- [ ] **I** TW-8a links per subject, TW-8b files per subject (needs E), TW-9 source picker (needs 8b). Plan 15 Phase 3, then Phase 4; Subjects (TW-1) exist
- [ ] **I** TW-14 Canvas connect (blocked on the OLFU token check and the classmate's feed host; fallback is a calendar feed URL; frames still to draw: Add subject hint, renewal chip, phone Home row, Join and "Add meeting link" on class rows; copy Canvas row frame 27:229 into the main file; spec `.claude/docs/revamp/13-canvas-connect-card.md`; the class form should expose `meetingUrl`)
- [ ] **I** TW-15 Canvas courses, announcements, syllabus
- [ ] **I** TW-2 focus timer, TW-3 notes, TW-4 reviewer as document, editor and export
- [ ] **I** TW-5 flashcards (sidebar row is a placeholder), TW-6 study blocks, TW-7 weekly digest
- [ ] **I** TW-10 quiz types, TW-11 calendar upgrades, TW-12 global search and palette, TW-13 archive subjects and term templates
- [ ] **I** Phase 4 leftovers per plan 15
- [ ] **I** Phones (720px and under) have no way to reach search; Home date subtitle hidden there
- [ ] **I** Canvas card on Home: placeholder row or wait (decide with TW-14)
- [ ] **I** Parked reviewer items: "reviewer ready" notification, exam link, sharing a reviewer to a group
- [ ] **J·Server** `lastMessage` on `GET /api/groups` so group rows show a preview, not "N members" (small server batch)
- [ ] **J·Server** `deleteGroup`, `leaveGroup`, `joinGroup` answer 200 `success:false` for non-members (should be 404)
- [ ] **J·Server** Two tabs adding the same timetable duplicate entries (server does not dedupe)
- [ ] **J·Server** Confirm Render's Node is 20+ (pinned in `server/package.json`)
- [ ] **J·People** A left group stays in the list until refresh
- [ ] **J·People** Pe3 smells: `people-friends.css` is 312 lines, `.people-avatar` lives in `people.css`; accepted differences to revisit: row line is "Code XXXXXX", empty Friends keeps the Add a friend card, profile has no phone frame, sent-request profile has no Cancel
- [ ] **J·Shell** Avatar menu: shadow Shadow/3 (0 12 32 .12), dividers inset 8px, icons 20px at x+16, item padding 8/10
- [ ] **J·Shell** Header title y30 on Study, Subject, Reviewer vs y26 on Home; desktop "+" y24, subtitle y62, cards from y106
- [ ] **J·Shell** Sidebar: first nav row y66, logo x16 y20, eyebrow block, bottom padding 20; collapsed rail check
- [ ] **J·Shell** Phone header: tools on one 44px row, long greetings max 2 lines (no Home phone frame)
- [ ] **J·Shell** Home hero: Join button 44h px20 with class-time chip; hero Join untested with a class today
- [ ] **J·Shell** Home spacing: 24 gaps, progress track 8px, week bars 24px in a 216px box, heading letter-spacing 0, search 40px
- [ ] **J·Shell** "Plan for you" cards not clickable (covered by NV1); Next step buttons stack at 1280 (card 230 vs frame 272); after Later on PSS the WHO-5 prompt shows at once
- [ ] **J·Shell** Press scale and drag-over lift still instant under reduced motion (`bottombar.css:90`)
- [ ] **J·Shell** Notch: header `top:-16px` leaves 4px of bell hit area in the safe area (`shell.css:25`); bottom bar height 65px duplicated in `bottombar.css` and `layout.css`; inactive tab colour a shade lighter than frame
- [ ] **J·Shell** Legal-prose links ~19px tall on phones; `Modal` always draws X when given a `title` (maybe add `closable`)
- [ ] **J·Plan** Day buttons 35 and 43px wide at 320 and 375, Month cells 41px at 320 (7 columns cannot reach 44)
- [ ] **J·Plan** `plan.css` ~511 lines (split); `home/TodayRows.jsx` and `plan/JoinLink.jsx` duplicate the Join anchor
- [ ] **J·Plan** Week grid times read "8:00 – 10:00 am"; task meta has no due time; "My week" select and Filter hidden in Month and Tasks; Month and Tasks read only the student's own plan
- [ ] **J·Plan** A deleted or unshared timetable stays in the switcher until reload; `Menu` and `SelectButton` cannot render rich rows
- [ ] **J·Wellbeing** `wellbeing.css` 445 lines (split); Why rows share one icon and show up to 4; day labels run from today; note wording "not a measure of your stress" in `weekReading.js`
- [ ] **J·Wellbeing** No Edit on rhythm in the empty hero, no "Add a class" button there; Cancel in the rhythm dialog drops edits without asking; no way to switch off a regular sleep schedule; Enter does not submit
- [ ] **J·Wellbeing** W2: owner OK on result words (Low, Moderate, High stress; Doing okay, Feeling a bit low, A hard stretch), WHO-5 copy and "What this changes" rows; no Exit confirm; "Not now" does not count as Home's Later; no better or worse line; no Move it on on the result
- [ ] **J·Wellbeing** `useCheckInResult.js` imports `sleepSummary` from wellbeing; tips-fallback path untested
- [ ] **J·Study** Empty Study step-pill gap 16px (frame says 8, check); reviewer progress bar radius (frame 4px)
- [ ] **J·Study** Subject Next-up capped at 5 rows (`NextUpList.jsx` MAX_ROWS) so a same-day exam can be cut; rows taller than frame; exam and class match only by title = subject name or code
- [ ] **J·Study** Practice column jumps up 56px when feedback shows; feedback screen scrolls on phones under 700px tall; focus-screen layout duplicated in `practice.css` and check-in css
- [ ] **J·Study** Exit uses replace so Back after Exit shows the reviewer twice; "Reviewer not found" Back points at the missing reviewer; sidebar highlight for `/study/reviewers/:id`; delete dialog focuses the destructive button; failed reviewer has no retry
- [ ] **J·Study** Long unbroken subject name breaks mid-word at 320px (`shell.css`); `study-failed` duplicates `home-failed`; New subject dialog compare with Figma
- [ ] **J·Study** Hidden controls to build when their backend or frame exists: reviewer Share, Make flashcards, Download PDF, Edit text, Rename, New questions, Targeted, header search pill, paste notes, question types, exam chip, Skip, subject Notes, Materials and Practice tabs, Add meeting link, Active and Archived segment, End this term, Resume row (needs `openSession` on the list)
- [ ] **J·Cleanup** Z1 delete the old `App.css` rules and legacy `.task-check`, `check-pop`, `.toast-with-action` in `styles/components.css`; `.app-boot` too
- [ ] **J·Cleanup** Z2 fixes pass; `useTaskDone.js:21` lint error and `useCheckInPrompt.js` lint warning; `AuthContext.jsx:11` repeats `backendUrl`
- [ ] **J·Cleanup** 1:1 Figma audits still owed: Wellbeing, Plan, and a numeric re-measure of Shell, Home and Study (tester needs Figma edit access to `rzpRwZFSbM1MjZRUgTY3Ok` or the current file)
- [ ] **J·Cleanup** Sync Figma sign-in frame 6:2 with the code (icons in fields, note position, hover) after owner approval
- [ ] **J·Cleanup** Offer a pass over the other 44 success toasts (owner: toasts feel AI-made)
- [ ] **J·Cleanup** Docs notes to write: server.md (TermsGate path, legal page routes), design.md (shell, 256px sidebar, 1120px content, sidebar from 1024px), notifications.md (shell polling, `markGroupRead`), motion.md (sliding pill, badge pop-in)
- [ ] **J·Cleanup** Ask the owner what they moved by accident in Figma; whether to install the `break-ui` skill (repo `emilkowalski/skills`)
- [ ] **K** Fill `client/src/utils/helpContacts.js` and the About team names (visible placeholders; never invent them)
- [ ] **K** Real phone check and real Google sign-in on stresscare.xyz and on the vercel.app link; email login sticks on a phone
- [ ] **K** Check VAPID keys are set on Render (production srv-dbeai2jrjlhs73f25dqg); re-enable web push on the new origin; real OS push test (second account posts in a shared group while the tab is in the background)
- [ ] **K** Manual reviewer tests at the end of `docs/reviewer-report.md` (live upload, real phone, scanned and password-protected PDFs, several students at once, a subject expert checking answers)
- [ ] **K** Try a real reviewer upload in production
- [ ] **K** Publish the consent form (placeholders: investigator, adviser, duration, researcher contacts)
- [ ] **K** Thesis core waiting on experts: W2, W3, re-evaluation
- [ ] **K** Delete the "(sample)" data from the owner's Atlas account when done (subjects, 5 timetable entries, 5 tasks)
- [ ] **K** Paste the Messenger "high school level" feedback into `docs/KNOWN_ISSUES.md`
- [ ] **K** Re-link `client/.vercel/project.json` to `stresscare` (`vercel link`) before any manual CLI deploy
- [ ] **K** Delete `wellbeingController.js` and `wellbeingRoutes.js` (owner said yes 2026-10-13)
- [ ] **K** Add tests for the Task, User and Notification controllers; there are no client tests
- [ ] **K** If billing is ever linked to the Gemini key, soften the Privacy Policy line about Google using the text (the Google AI Pro subscription does not count)
- [ ] **K** Staging leftovers: one test sign-up, new `JWT_SECRET` on the staging Render service, decide on a separate Brevo key, optionally rotate secrets pasted in chat
- [ ] **K** Remove the now-unused production `VITE_BACKEND_URL` (builds ignore it)
- [ ] **K** Branches are never deleted by Claude; the owner cleans them up
