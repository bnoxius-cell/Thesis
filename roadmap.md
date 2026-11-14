# Roadmap

The only list of open work, in order (reorganized 2026-11-14). Owner priority #1: quality of life of what is built. Priority #2: spread load over free accounts (plan 26). New features live in `to-build-after-thesis-defense.md`. State and rules: `handout.md`. Team feedback: `docs/KNOWN_ISSUES.md`. The owner's loose ideas go in `notes.md`; once an idea is here, it leaves `notes.md`. Old versions: `.claude/docs/archive/2026-11-13/` and `.claude/docs/archive/2026-11-14/` (the long small-items lists J, E, U, L and every original owner question are there).

Every batch: branch off `main`, builder runs `npm test` in `server/` and `npm run build` in `client/`, tester after, merge. "Start" is the builder to start with; step up only after a failed test. "Figma" means the frame is drawn (design skills loaded) and approved by the owner before the builder starts. Every push to `production` needs a What's new note first.

## Open work, in order (owner 2026-11-14, wins over everything else)

1. **Placeholder pages** (Notifications drawer and phone sheet, Me: Profile, Settings, Privacy, Help, About). Planner is writing `.claude/docs/plans/36-placeholder-pages-plan.md` (refresh of plan 15: FG1, N1, M1-M3, AB1). Then draw the FG1 frames in Figma and get them approved, then build: Settings first (unlocks plan 32 WN3/WN4 and item 9), then N1, Help and About last. Help needs the owner's `client/src/utils/helpContacts.js`, About needs the team names (never invented). The owner can ask for the OV-F1..F8 frames in the same Figma sitting.
2. **"Other stuff"**: still unspecified. Ask once with AskUserQuestion (item 12 leftovers, release prep, owner to-dos below).
3. **Plan 34, a class is a subject** (`.claude/docs/plans/34-class-is-subject-plan.md`), pushed back behind item 1: C5 edit and delete entries (`feature/plan-edit-entry`, built 8e75f48 + a55b5cd, NOT merged, test it first, fold in the four S1a reviewer lows in `handout.md`), then C6a, release, M1 migration (needs plan 34 Q6, dry run on Atlas first), S1b, C1, C2, C3 subject Overview redesign (owner wants it improved; needs the CT, NT and OV frames approved), release. Before the release: read-only Atlas check for owners with more than one main timetable: `db.schedules.aggregate([{ $match: { isMain: true } }, { $group: { _id: "$owner", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])`. Empty: go. Rows: owner OKs a one-off repair (keep one main, demote the rest) first.
4. **Plan 35 flashcard import and study goals** (all 13 questions answered, Q8 = no), pushed back behind item 1: IM0 (pure parser and break rules, any time), IM1 import route, IM2 dialog (needs IM-F1..F6 approved), BR1 and BR2 breaks (need BR-F1..F3), release.
5. **Study Figma round**, one sitting: plan 28 frames SC-F1 to SC-F4 plus round 27 F27-1 to F27-5. Then subject covers phase 1 (plan 28 SC1 to SC3, `feature/subject-covers`, SC1 builder-haiku medium, SC2 and SC3 builder-sonnet low).
6. **Reviewer batches**: RV3 edit, delete and retry reviewers (`feature/reviewer-edit`, builder-sonnet low, after 5), RV2 subject tag everywhere with eight real colours (`feature/subject-tag`, builder-sonnet medium; this is also where the "subject card is hard to find" note lands), RV4 larger files and smaller photos (`feature/upload-limits`, measure the Vercel body limit first, builder-sonnet medium), RV8 sleep plan explainer (`feature/sleep-explainer`, builder-sonnet medium; the notes ask for six answers in order: what it is, how to set it up, where to look, what to look for, what it means, what to change), RV9 "Making your reviewer" screen (`redesign/reviewer-waiting`, builder-sonnet medium; keep the "writing questions" counter).
7. **UX consistency fixes** (plan 31 Part C, UX1 to UX6; Figma per fix where the plan says so). The live pass of the audit is still to run. Known cases: Study tabs jump (tab 1 has a big card, tabs 2 and 3 don't); Month shows events, activities, holidays and uncoloured tasks as the same grey chip; the empty "current task" area (needs a friendly empty state like Friends); empty states; nav labels; same spot for primary actions.
8. **Study Add menu order**: Study's group in the global Add menu offers Task (and maybe Exam) up front, not under "everything else". A task can belong to a subject, not every task has one, every subject has tasks. Figma touch-up first, then builder-sonnet low. Owner open: whether Exam goes there too.
9. **Account and trust**: forgot password, auth hardening, account deletion (`feature/` per item, builder-sonnet high, code-reviewer before merge). Also the Terms re-accept screen: it should differ for first-time users and users who already agreed to the previous terms (owner note 2026-11-14, screenshot; needs a Figma look first, uses `LEGAL_VERSION`).
10. **Feedback dialog** FB1, FB2 (plan 17, builder-sonnet medium).
11. **Plan 32 WN3/WN4** (permanent list in Settings, "new" dot): after Settings (item 1).
12. **Small fixes and polish**, source: archived sections J, E, U, L:
    - Home greeting is truncated at 320 and 375 next to Add and the bell.
    - "Uploaded N files" toast is unreliable on Files when the upload dialog closes early (`features/files/useUploadDialog.js:35-44`); a toast after a failed host-dialog upload can't be followed.
    - Study still shows a second "+ New subject" beside the global Add, check against the frame.
    - Segment buttons 44px (`shared/ui/segment.css`); Plan, Study, Wellbeing smells; upload dialog and file viewer leftovers; animation pass.
    - C10 leftovers: (a) ConfirmDialog Cancel is a text link but frames 239:5577 and 239:5904 show an outlined pill, fix in the shared `ConfirmDialog` and check every confirm; (b) timetable menu rows are 54px, frame says 52px (`timetable-menu.css` `.global-add__item`); (c) a member's Leave dialog closes silently on a 404 after the owner deletes the timetable, show the error; (d) move the shared Add menu row classes into `shared/ui/menu.css` and the danger rule into `global-add.css`; (e) one flaky `npm test` while the build ran at the same time, watch for it; (f) the More button outline uses `--text-primary`, check against frame 239:4833.
    - Flashcard follow-ups: deck rows on the subject Practice tab show a redundant subject chip and differ from frame FC-F17 (layers icon left, "N due" chip, More menu); the phone floating Make flashcards button overlaps footer links on a short page; ConfirmDialog opens with focus on the destructive button; the review empty state says "due tomorrow" even with no cards.
    - Add sheet drag: owner to feel-test on a real phone.
13. **Plan 26 "do now" slice**: N1 Render dashboard audit (owner, any time), N2 cold standby on the owner's Gmail account (O8), N3 env hash script (`chore/env-hash`, builder-haiku low).
14. **One site toast** (plan 29 T1, `feature/site-toast`, builder-sonnet medium): last in line. Blocked on approving the toast frames (Toast/Added 221:4875, 221:4876 desktop, 223:715 phone). Bottom centre on desktop, above the tab bar on phones, polite, about 6 s, pauses on hover or focus, never covers the bottom nav or a Save button. 29 files call `toast.*` and `App.jsx:15` sets the container top-right: restyle and move react-toastify's container and add the View action before writing a new component.
15. **Organize tasks**: concept only, last of all, see `to-build-after-thesis-defense.md`.

Not before the defense: see `to-build-after-thesis-defense.md` (reading reviewer type, subject cover photos, and more).

## Owner open questions
Skip button on typed answers; filled blank vs `_____` after grading; flashcard end-screen wording; C9 cheer-line wording; H2 look (extend the wash to class blocks, `.home-row`, `.day-row`? tooltip overlaps "This week" on Home; overdue chips double border); whether Exam also goes under Study in the Add menu.

## Owner decisions on record
All design and plan questions were answered 2026-11-13 and 2026-11-14 and live in the plans; the original question lists are in the 2026-11-14 archive. In short: Mixed is the default question type; Study storage 200 MiB; PowerPoint/Word picture stripping only after the defense; photos over 4 MB only shrink; standby API on the owner's Gmail account; one Covers/Colours switch, soft tint plus top band, symbol guessed from the name, no picker in New subject, own cover photos after the defense, cover photos don't count toward storage; global Add button left of Search, Home is the Plan group, phone button in the top bar; shared timetables: owner and editors edit, viewers only see; a Month day opens the day window with "Open this week"; about six fixed cheer lines by how full the day is; done lines stay random; hover: whole day column soft, bar tooltip on desktop; page titles stay the section name; Month exam is icon plus title; Pick up moves inside the Subjects panel; toast closes after 6 s; feedback dialog stays; plan 35 Q8 no.

## Owner and thesis tasks (Claude cannot do these)
- Delete the test account sctestjmon93gs@fldubai.com, the 3 leftover test files, group `tester-chat` and the "(sample)" data in Atlas.
- Fill `client/src/utils/helpContacts.js` and the About team names.
- Real phone check on stresscare.xyz and the vercel.app link.
- Confirm VAPID keys on Render (srv-dbeai2jrjlhs73f25dqg) and test a real push.
- Point UptimeRobot at `/api/health`; remove dead monitors (`jarvis-bot-qcza`, `tomewisp`).
- Publish the consent form (placeholders: investigator, adviser, duration, contacts). Thesis core waits on experts: W2, W3, re-evaluation.
- Manual reviewer tests at the end of `docs/reviewer-report.md`.
- Re-link `client/.vercel/project.json` to `stresscare` before any manual CLI deploy.
- Delete `wellbeingController.js` and `wellbeingRoutes.js` (owner said yes 2026-10-13; a chore batch can do it).
- Live checks owed after the 2026-11-14 releases: What's new popup once and See all updates, bullets at 375px and 1280px, Render logs clean, flashcards (deck from a reviewer, review two cards, Terms re-accept once).
- Release command: `! git branch -f production main && git push origin production` (after a What's new note).

## Done (short)
- Storage and Study: foundation, Study hub, subject tabs, Practice, Files with folders and Move to, upload dialog, file viewer (live 2026-11-06). New reviewer sources: PDF, Word, PowerPoint, photos, Create new subject, Subject files.
- People, footer, security headers, `/api/health`, Practice "In progress", sign-in open to all users, reviewer share cards (server).
- Plan 25: S1, S2, C1 to C4, C9 day window, C10 timetable menu. Month shows everything Week shows. Unique main-timetable index.
- Plan 27: RV1 source line, RV5 heaviest-day ring (live). Plan 29: global Add A1 to A3. Plan 30: hover polish H1 and H2. Plan 34: S1a and the entry form without the Type switcher.
- Plan 33: question types (QT1 to QT5) and flashcards FC1 to FC6. Plan 32: What's new popup, modular dated notes, grouped entries, `/whats-new` page, bullets (production c7cfeb7, 2026-11-14). Drag-to-close for every phone sheet.
