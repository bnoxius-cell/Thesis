# Session handout

Main session only: read this first after a `/clear` (subagents skip it unless their brief says otherwise). It's the short "where we left off" note: current state, open items and next steps. Rules are in `CLAUDE.md`, feature notes in `.claude/docs/`, older session notes in `handout-archive.md`.

Last updated: 2026-10-13 (end of planning session; owner continues 2026-10-14). **Everything left is planned in `build-queue.md` (Q1 to Q14). Next: spawn `builder` on Q1.** Nothing is blocked on the owner. 450 server tests pass, client builds clean, `main` is clean and pushed. Branch from `main` for each batch.

## Subagent workflow (set up 2026-10-13, made global the same day)
- The agents are global, in `~/.claude/agents/`, and apply to every project: `builder` (Sonnet 5.5, high effort), `code-reviewer` (Opus 5.5, high, read-only) and `Explore` (Haiku 5.5, replaces the built-in one and skips CLAUDE.md). The rules are in the global CLAUDE.md and `~/.claude/docs/subagents.md`; this project's specifics are in CLAUDE.md "Workflow". The owner dropped the ask-before-spawning rule. The first, project-only copies in `.claude/agents/` were removed so they can't override the global ones.
- `CLAUDE.md` went from 68 KB to 12 KB. Its feature notes moved unchanged into `.claude/docs/` (gitignored, like CLAUDE.md), the to-do list into `.claude/docs/todo.md`, and a full copy of the old file is in `.claude/docs/old/`. Older handout sections moved unchanged into `handout-archive.md`; the gotchas now live in `.claude/docs/testing-and-gotchas.md`.
- **First real `builder` run worked (2026-10-13)**: review items 2 to 6 on `fix/fe-review-items`, about 13 minutes. It followed the brief, ran the checks, committed without merging and wrote a useful report. Two lessons: a brief that names one file gets only that file (it left the same bug in Profile when told "Friends"), so name every place; and its process cleanup killed every `vite.js` by name, which can stop the owner's dev server (now a note in `testing-and-gotchas.md`; say "stop only what you started" in briefs).

## REVAMP (started 2026-10-27, read this first)
- Opus tester, Opus code-reviewer and Jo Anne Ferrer's expert evaluation (verdict: major revisions) are merged into `.claude/docs/revamp/`. Start at `README.md`, then `04-revamp-backlog.md` (workstreams W1 security, W2 algorithm, W3 wording and consent, W4 frontend, W5 cleanup) and `05-frontend-revamp.md`.
- Nothing was built yet. Open owner decisions are listed at the top of `04-revamp-backlog.md` (sign-up domain, Guidance Office details, referral on low scores, score split, research consent, frontend questions).
- More psychologist feedback is coming: add it as `01b-...md` and merge items into `04`.
- Suggested next step: planner on W1 (`fix/auth-hardening`, overlaps build-queue Q1), code-reviewer before merge.
- **Frontend plan written 2026-10-28: `.claude/docs/revamp/06-frontend-plan-v2.md`** (Figtree, calmer slate-blue palette, 3 schedule presets, Guide in header, cascade layers; batches FE-0 to FE-10, one branch each `redesign/v2-feN-...`). Owner answered O1 (task course optional), O2 (one shared project email, address not given yet), O3 (Guide opens on first visit of each page). Next: tag `pre-frontend-v2`, then builder-sonnet high on FE-0. Dev servers run on 5173/5000 (real Atlas). W2 planner must adopt the `toWeekReading` shape (plan O5).
- **Owner decisions answered 2026-10-28** are at the top of `.claude/docs/revamp/04-revamp-backlog.md`. Merge policy: passing batches go into one branch, `redesign/v2-integration`; nothing goes to `main` until the owner has tested it locally.
- **Overnight run (owner chose option 1, 2026-10-28):** FE-0, FE-1, FE-2, FE-3, FE-4, FE-5, FE-7, FE-8, FE-9, then W1 auth (with code-reviewer and security-review). Each batch: builder, tester, fix round if needed, merge into `redesign/v2-integration` (branch it from `main` after FE-0 passes). Never merge or push to `main`. Two failed rounds on a batch: park it and move on. Skills per plan "Skills" section. In the morning: W2, W3, FE-6, FE-3b, FE-10, W5. Progress per batch is logged below.
- **Overnight progress log** (branch each batch from `redesign/v2-integration`, merge back after tester pass; nothing on `main`):
  - FE-0 PASSED, merged (34cab28).
  - FE-1 PASSED + fix round (pinned sheet actions, focus return, share overflow, tonal/danger states), merged (e9fea97). Deferred: 44px buttons on People/Profile at 1280 (FE-7/FE-9), un-gated hover lifts (FE-5/FE-8), Reviewers empty state (FE-8).
  - FE-2 PASSED + fix round (Guide resets on list/detail swap via `tour.view`, focus to `main` after nav, Guide waits out dialogs, About#contact scroll margin; harness now seeds a reviewer), merged (c3a7540). Deferred: focus return for dialogs opened via `<a ?task=new>` (FE-3/4), Guide panel overlapping targets at 1280, Reviewers `rev-list` steps.
  - FE-3 Today PASSED + fix round (reasons agree with band, DOM in phone order via `TodayLayout.jsx`, "Not today" focus, 7-day wording, About caption, week card as lead), merged. Adapter `utils/weekReading.js` `toWeekReading` is the FE-3b seam. Deferred: last Guide step 37% covered by sheet at 375.
  - FE-4 quick add building on `redesign/v2-fe4-quick-add` (course optional per O1). Next: FE-5, FE-7, FE-8, FE-9, then W1 auth.
  - Dev server on 5173/5000 was stopped by low memory at ~night; do not restart unless the owner asks.
  - Tester's weakest-looking list after FE-2: old Today week card (FE-3), oversized sign-in card (FE-9), sparse Study/People (FE-8/FE-7). FE-2 notes: update `mobile-rules.md` (still mentions floating Guide button); footer Help links to `/profile/<id>#help` (FE-9); `.app-boot` still text; Guide trigger can look dead on the open reviewer view.
  - Context note: orchestrator context is large (~150k). If this session was cleared, resume from this log: read plan `06-frontend-plan-v2.md`, `git log redesign/v2-integration`, and continue with the next batch.
- This section takes priority over the build-queue order below.

## Where to pick up (older, build-queue)
- **`build-queue.md` is the plan.** Each Q section is a full brief. Spawn: `Build Q<n> from build-queue.md. Branch: <branch>. Read that section and the files it points to. Stop only the processes you started.` Then review (when marked), merge, push, tick, update docs. One builder at a time.
- **Next: Q1 `fix/auth-hardening`** (SR Batch 1 plus S6 and S4), then `code-reviewer` before merging. Q2 (session expiry) must come after Q1, same middleware.
- Before the panel: Q1 to Q7 (auth, session expiry, share tags, npm audit, cleanup, delete-user script, code splitting). After: Q8 to Q14 (reviewer ready notification, chat history, breather, daily check-in, focus timer, reviewer exam link, nodemailer and controller tests).
- Owner answers 2026-10-13: S6 neutral wording on reset only; S4 yes (reset ends other sessions); R4 delete the dead wellbeing files; plan all parked features. Opus decided (recorded in `frontend-plan.md` Decided): the daily check-in and focus time don't change the workload score.
- Checked against the code 2026-10-13: SR B11, B17 and Batch 9 had already landed in the FE batches (now ticked); R6 is half done (Q5 finishes it).
- Keeping usage low: run 2 or 3 queue items, update this file, then `/clear`. The queue and this file carry the state.
- Owner to-do: fill in `client/src/utils/helpContacts.js` and the About team names (visible placeholders), real phone pass on the deployed site, say whether to record a DESIGN.md, manual reviewer tests, real Google sign-in on the live site, and a real reset email after Q1 deploys.
- Lint has a few known `set-state-in-effect` / `react-refresh` errors, an existing pattern, left alone.

## Not verified yet (needs a human)
- **Actual OS push alert.** Chrome's permission prompt can't be clicked by automation. Click "Turn on" under "On this device" on the Notifications page, allow it, then have another account post in a shared group while the tab is in the background or closed.
- **Phone.** Needs the deployed HTTPS site. On iPhone: Add to Home Screen first.
- **Web Push in production.** Nobody has confirmed that `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are set on Render (an old "Next up" item, now in `handout-archive.md`). Without them the inbox still works but phone and PC alerts stay off. Check the Render dashboard.

## Owner's standing rules (from global CLAUDE.md, easy to forget)
- Branch before editing code. When starting new, distinct work, commit, push and merge the old branch into `main` automatically, but never delete branches.
- Subagents: spawn them without asking (owner's call, 2026-10-13), the way the global CLAUDE.md and `~/.claude/docs/subagents.md` describe.
- **`frontend-plan.md` exists since 2026-10-12.** UI work follows it. The only design questions to ask are the ones in its Open list.
- No `Co-Authored-By` lines in commits or PRs.
- Docs: after each task, put feature facts in the matching `.claude/docs/` file (CLAUDE.md only gets rules and pointers), tick `.claude/docs/todo.md` and the plan, and put anything still in progress in `handout.md`.
- Writing style: plain sentences, no em-dashes as connectors, no "not just X, it's Y". No emojis in UI (use lucide-react).

## Gotchas
Moved to `.claude/docs/testing-and-gotchas.md`: UI harness quick start, headless Chrome, Chrome extension quirks, ports.
