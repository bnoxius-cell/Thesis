> ORDER CHANGE 2026-11-13 (owner): plan 33 first, then plan 34 (C5 onward), then plan 35. See handout.md.

# Roadmap

The only list of open work, in order (rewritten 2026-11-13; supersedes plan 27 section 0). Owner priority #1: quality of life of what is built. Priority #2: spread load over free accounts (plan 26). New features live in `to-build-after-thesis-defense.md`, not here. State and rules: `handout.md`. Team feedback: `docs/KNOWN_ISSUES.md`. Older versions: `.claude/docs/archive/2026-11-13/roadmap.md` (holds the long small-items lists J, E, U, L for item 24).

Every batch: branch off `main`, builder runs `npm test` in `server/` and `npm run build` in `client/`, tester after, merge. "Start" is the builder to start with; step up to the ceiling only after a failed test. "Figma" means the frame must be drawn (design skills loaded) and approved by the owner before the builder starts.

## Open work, in order

**TOAST MOVED TO THE END (owner 2026-11-13): item 6 (site toast, plan 29 T1) is last in line, after item 26. Global Add (item 7) starts now and keeps today's toast look; it only adds the small `showActionToast` helper for the View button.** 
**OWNER ORDER (2026-11-13, overrides the grouping below): work the "Blocked on the owner" group first (item 7 now; item 6 moved to the end, see above; frames approved), then the "Needs Figma" group (items 8 to 14), then "Ready now" (items 1 to 5), then everything after item 14.** Item numbers stay as listed. Plan first, then build one batch at a time.

**OWNER ORDER 2026-11-13 (latest, overrides the line above for what comes next): C9, C10, then C5, C6, RV1, RV5 (RV1 and RV5 are two separate items, not a range), then REVIEWER QUESTION TYPES and FLASHCARDS (one block, plans 27 RV6/RV7 and 20, new plan first). Question types: multiple choice (exists), identification, mixed, true or false, enumeration / fill in the blank, essay (AI grades it, needs a plan and a daily cap decision), more if the planner finds good ones. Frames for all of it are drawn alongside the builds, so no Figma wait after RV5. After that block: a read-only "document" reviewer (just read, no interaction), idea only, see `to-build-after-thesis-defense.md`.**

**PLAN 34 (class is subject, owner 2026-11-13, written, answers recorded): runs before C6 and replaces most of it. DONE 2026-11-13: H2, S1a (cb21053), entry-form Type removal. Order per the plan: C5 (next, plus the S1a reviewer lows in handout.md), C6a, release, M1 migration (dry run on Atlas first), S1b, C1, C2, C3 Overview redesign. Figma round CT-F1 to F4, NT-F1, OV-F1 to F8 drawn while S1a to S1b build. Plan: `.claude/docs/plans/34-class-is-subject-plan.md`.**

**Ready now (no owner input needed)**
1. C5 edit and delete classes, exams, events, activities (plan 25 C5). `feature/plan-edit-entry`. Start builder-sonnet medium, ceiling high. Frames approved (D2, D4, D5).
2. C6 Study subject rows, "Add class" from a subject (plan 25 C6). `feature/subject-rows`. Start builder-sonnet medium, ceiling high. After 1.
3. Release to `production` after 2. First a read-only Atlas check for owners with more than one main timetable (the new unique index fails to build on them): `db.schedules.aggregate([{ $match: { isMain: true } }, { $group: { _id: "$owner", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])`. Empty: release. Rows: owner OKs a one-off repair with the same rule as `ensureMainSchedule` (keep one main, demote the rest), then release; if the index still failed at boot, restart the Render service once so it builds. Tester does a live pass after.
4. DONE 2026-11-13 (merged to main, tester passed). RV1 reviewer source line "N files · M pages" (`fix/reviewer-source-line`, start builder-haiku medium) and RV5 heaviest-day bar ring (`fix/heaviest-today-bar`, start builder-haiku low). Plan 27. No Figma. Tag `pre-plan-27` first. Filler while the owner reviews 3b.
5. UX consistency audit, planner only (was 3a). One pass over the built pages for the four goals (clarity, consistency, navigation, friendliness) that also folds in the panel feedback in `docs/KNOWN_ISSUES.md` (less on screen, Today first look, workload explanation, check-in result wording). Known cases: Study tabs jump (tab 1 has a big card, tabs 2 and 3 don't); Month shows events, activities, holidays and uncoloured tasks as the same grey chip (give event and activity a prefix or icon); the empty "current task" area in notes.md; empty states; nav labels; same spot for primary actions. Output: one plan file, fixes ordered by impact, Figma flagged per fix. Can run alongside 1 to 4. Plan: `.claude/docs/plans/31-ux-consistency-audit-plan.md` (brief for the live pass + 12 findings verified from code; live pass still to run).

**Blocked on the owner**
6. One site toast (was 3d). `feature/site-toast`. Start builder-sonnet medium. Blocked on approving the 3b toast frames (Toast/Added 221:4875, 221:4876 desktop, 223:715 phone). Bottom centre on desktop, above the tab bar on phones, polite announcement, about 5 s, pauses on hover or focus, never covers the bottom nav or a Save button. Tip for the brief: 29 files call `toast.*` and `App.jsx:15` sets the container top-right, so restyle and move react-toastify's container and add the View action before writing a new component. Plan: `.claude/docs/plans/29-site-toast-and-global-add-plan.md` batch T1.
7. A1, A2 and A3 DONE 2026-11-13 (A1/A2 merged c3457e6; A3 People and Files merged a03abd0; frames D9, D10, hover H-F1..H-F5 and A3 approved by the owner). One global "+ Add" (was 3b). `feature/global-add-menu`. Start builder-sonnet medium. Frames drawn (page "Global add (3b)", node 223-1198), awaiting approval and three answers (Needs owner decision). Replaces Home's AddTaskButton, Plan's AddToPlanMenu, Study's add subject. After 6. Plan: plan 29 batches A1, A2 (A3 People and Files only if its O2 is yes).
8. Figma, Plan round 2: D9 day window (owner's day popup: a day's classes, deadlines and tasks, each opens its details window inside, plus a cheer line), hover states for everything clickable (owner's notes: keep today's hover style, add highlights, colour changes and smooth motion; highlight the day when hovering a task or the day itself; Home and Wellbeing bars clickable), D10 timetable menu. Drawn while 6 and 7 build. Needs plan 25 Q6, Q7. Hover frames H-F1 to H-F5: `.claude/docs/plans/30-hover-polish-plan.md` section 3.
9. C9 day window (plan 25 C9). `feature/day-window`. Start builder-sonnet medium, ceiling high. After 8.
10. DONE 2026-11-13 (merged 3ff3a11; unfixed leftovers are in item 24). C10 timetable menu: rename, delete, leave (plan 25 C10; owner note "a schedule is just there forever"). `feature/timetable-menu`. Start builder-sonnet low, ceiling medium. After 8.
11. Hover polish (from 8). `feature/hover-polish`. Start builder-sonnet low, ceiling medium. After 9 (both touch Week and Month). Plan 30: H1 (`chore/hover-motion`, start builder-haiku medium, no Figma, can run any time) then H2.
12. UX fix batches from the plan in 5, in its order. Figma per fix where the plan says so. First cut: plan 31 Part C, UX1 to UX6.
13. Figma, Study round, one sitting: plan 28 covers frames SC-F1 to SC-F4 (and SC-F6 if CV1 = A) plus round 27 F27-1 to F27-5 (F27-2 is plan 25 D7; plan 25 D8 is replaced by the cover dialog). Needs O7 and CV1 to CV4.
14. Subject covers phase 1 (was 3e; plan 28 SC1 to SC3, includes plan 25 C8). `feature/subject-covers`. SC1 start builder-haiku medium, SC2 and SC3 start builder-sonnet low, ceiling medium. After 13.
15. RV3 edit, delete and retry reviewers (= plan 25 C7). `feature/reviewer-edit`. Start builder-sonnet low. After 13.
16. RV2 subject tag everywhere (eight real colours). `feature/subject-tag`. Start builder-sonnet medium. After 13; O5.
17. RV4 larger files and smaller photos; measure the Vercel body limit first. `feature/upload-limits`. Start builder-sonnet medium. O3, O6.
18. (DONE 2026-11-14, merged 5261cc2, release pending; essay deferred; owner open: Skip button, filled blank) RV6 question types, server (`feature/question-types-server`, start builder-sonnet high), then RV7 client (`feature/question-types-ui`, start builder-sonnet medium). O2, F27-3.
19. RV8 sleep plan explainer. `feature/sleep-explainer`. Start builder-sonnet medium. F27-4 and the owner's OK on wording.
20. RV9 "Making your reviewer" screen. `redesign/reviewer-waiting`. Start builder-sonnet medium. F27-5.
21. Placeholder pages: Notifications drawer, Me (Profile, Settings, Privacy, Help), About. Figma first. Old sections D and F.
- BEFORE THE DEFENSE (owner 2026-11-13, WQ1 answered). Concept planned, Figma first, build after the Figma round: "What's new" patch notes window plus a permanent list in Settings (plan 32). `feature/patch-notes`. Figma WN-F1 to WN-F5 first. Start builder-haiku (WN1) and builder-sonnet low (WN2).
22. Account and trust: forgot password, auth hardening, account deletion. `feature/` per item. Start builder-sonnet high, code-reviewer before merge.
23. Feedback dialog FB1, FB2 (plan 17). Start builder-sonnet medium. O1.
24. Small fixes and polish (Home greeting is truncated at 320 and 375 next to Add and the bell, pre-existing, found by the RV tester; A3 tester 2026-11-13 adds: the "Uploaded N files" toast is unreliable on Files when the upload dialog is closed early, see `features/files/useUploadDialog.js:35-44`, pre-existing; a toast after a failed host-dialog upload can't be followed; Study still shows a second "+ New subject" beside the global Add, check against the frame): Segment buttons 44px (`shared/ui/segment.css`), Pe/Plan/Study/Wellbeing smells, upload dialog and file viewer leftovers, animation pass. Source: archived sections J, E, U, L. C10 leftovers (tester 2026-11-13, not fixed): (a) ConfirmDialog Cancel is a text link but frames 239:5577 and 239:5904 show an outlined pill, so fix it in the shared `ConfirmDialog` and check every confirm; (b) timetable menu rows are 54px, frame says 52px (`timetable-menu.css` `.global-add__item`); (c) if an owner deletes a timetable while a member's Leave dialog is open, the server's 404 closes the dialog silently, show the error; (d) move the shared Add menu row classes into `shared/ui/menu.css` and the `.ui-menu__item--danger .global-add__title` rule into `global-add.css` (today `timetable-menu.css` imports `@/app/shell/add/global-add.css` across folders); (e) one `npm test` run had 1 flaky failure while the build ran at the same time, reruns 1363/1363, watch for it; (f) the More button's 1px outline uses `--text-primary`, check it against frame 239:4833.
25. Plan 26 "do now" slice: N1 Render dashboard audit (owner, any time), N2 cold standby (O8), N3 env hash script (`chore/env-hash`, start builder-haiku low).
26. Subject covers phase 2, own photo (plan 28 SC4, SC5, code-reviewer). `feature/subject-cover-photo`. Only if CV5 says before the defense; otherwise it moves to `to-build-after-thesis-defense.md`.

## Owner decisions
ALL ANSWERED 2026-11-13. G1 to G3 as drawn (frames approved). Plan 25 Q3, Q6, Q7 yes. Plan 27: O1 keep, O2 Mixed, O3 200 MiB, O4 yes after defense, O5 reviewer row, O6 over 4 MB only, O7 draw all five. Plan 26 O8: standby on the owner's Gmail account (not the recommended teammate's). Plan 28: CV1 one Covers/Colours switch, CV3 guess symbol from name, CV4 no picker in New subject, CV5 own photos after the defense (item 26 moves to `to-build-after-thesis-defense.md`), CV6 cover photos do NOT count toward storage. CV2 ANSWERED 2026-11-13: soft tint plus top band, no stripe. Plans 29 to 31 (answered 2026-11-13, all as recommended): Add menu O1 Plan first on other pages, O2 move People's + and Files' Upload into the global menu after a Figma touch-up, O3 keep the random done lines; hover HQ1 whole day column soft, HQ2 desktop bar tooltip, HQ3 not asked, default no (leave old App.css hover rules); audit UQ1 titles stay the section name and fix the sidebar in the Figma frames, UQ2 Month exam as icon plus title, UQ3 Pick up moves inside the Subjects panel. Toast closes after 6 s (Figma), not 5. The list below keeps the original wording.
Global add (3b frames, blocks 6 and 7):
- G1. Button left of Search (drawn) or far right after the avatar? Recommend as drawn.
- G2. Home counts as the Plan group (drawn) or no group first on Home? Recommend as drawn.
- G3. Phone button in the top bar (drawn) or floating above the tab bar? Recommend top bar (same spot everywhere).
Plan 25 (blocks 1, 8, 9):
- Q3. Shared timetables: owner and editors edit entries, viewers only see details? Recommend yes (the server's roles).
- Q6. Clicking a Month day opens the day window instead of jumping to the week? Recommend yes, with "Open this week".
- Q7. Day window cheer line: about six fixed short lines picked by how full the day is, never about scores? Recommend yes.
Plan 27:
- O1. Keep the feedback dialog (item 23) or defer? Recommend keep.
- O2. Default question type in New reviewer. Recommend Mixed.
- O3. Study storage per student 100 or 200 MiB when files may be 20 MiB. Recommend 200.
- O4. Strip pictures from PowerPoint and Word in the browser (adds `fflate`). Recommend yes, after the defense.
- O5. Which screen showed the "OPS411" card? Recommend treating it as the reviewer row.
- O6. Shrink photos in Study uploads too? Recommend only photos over 4 MB.
- O7. Draw all five round 27 frames or waive some? Recommend draw all five (item 13).
Plan 26:
- O8. Whose account holds the standby API? Recommend a teammate's.
Plan 28 (subject covers, blocks 13 and 14):
- CV1. Plain colour look: one Covers/Colours switch for the whole list, or a "Plain" choice per subject? Recommend one switch.
- CV2. Plain look as top band, left stripe or soft tint? Recommend top band.
- CV3. Default symbol guessed from the subject name, or a book for all? Recommend guessed.
- CV4. Pick the cover in the New subject dialog too? Recommend no.
- CV5. Own photos before or after the defense? Recommend after.
- CV6. Cover photos count toward Study storage? Recommend yes, 300 KiB each.

## Owner and thesis tasks (Claude cannot do these)
- Delete the test account sctestjmon93gs@fldubai.com, the 3 leftover test files, group `tester-chat` and the "(sample)" data in Atlas.
- Fill `client/src/utils/helpContacts.js` and the About team names (never invent them).
- Real phone check on stresscare.xyz and the vercel.app link.
- Confirm VAPID keys on Render (srv-dbeai2jrjlhs73f25dqg) and test a real push.
- Point UptimeRobot at `/api/health`; remove dead monitors (`jarvis-bot-qcza`, `tomewisp`).
- Publish the consent form (placeholders: investigator, adviser, duration, contacts). Thesis core waits on experts: W2, W3, re-evaluation.
- Manual reviewer tests at the end of `docs/reviewer-report.md`.
- Re-link `client/.vercel/project.json` to `stresscare` before any manual CLI deploy.
- Delete `wellbeingController.js` and `wellbeingRoutes.js` (owner said yes 2026-10-13; a chore batch can do it).
- Remove `Co-Authored-By` from 13c81c3 with a force-push? Default: leave it.
- Release command: `! git branch -f production main && git push origin production`.

## Done (short)
- Storage and Study: foundation, Study hub, Subject tabs, Practice, Files with folders and Move to..., upload dialog, file viewer. Live since 2026-11-06.
- New reviewer sources (PDF, Word, PowerPoint, photos, Create new subject, Subject files): released c1b68c7.
- People (Pe1 to Pe5), footer, security headers, `/api/health`, Practice "In progress" status.
- Plan 25 S1, S2, C1, C2, C3 live (f25aef0). Sign-in open to all users and CH3 reviewer share cards (server), released f25aef0.
- 2026-11-13: sign-up email fixed (Brevo IP block off) and live checks done; C3 fix round merged 110932e; C4 add class, exam, event, activity merged 68de136; Month shows everything Week shows merged da16a3b; flaky race tests fixed with a unique main-timetable index merged f2a4b2a. Not yet released (item 3).

- Organize tasks: concept only, the last thing in the queue, not planned. See `to-build-after-thesis-defense.md` ("Organize tasks").
