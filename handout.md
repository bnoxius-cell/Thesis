# Session handout

Main session only: read this first after a `/clear` (subagents skip it unless their brief says otherwise). It's the short "where we left off" note: current state, open items and next steps. Rules are in `CLAUDE.md`, feature notes in `.claude/docs/`, older session notes in `handout-archive.md`.

Last updated: 2026-10-13 (planning session). **Everything left is planned in `build-queue.md` (Q1 to Q14). Next: spawn `builder` on Q1.** Nothing is blocked on the owner. 450 server tests pass, client builds clean, `main` is clean and pushed. Branch from `main` for each batch.

## Subagent workflow (set up 2026-10-13, made global the same day)
- The agents are global, in `~/.claude/agents/`, and apply to every project: `builder` (Sonnet 5.5, high effort), `code-reviewer` (Opus 5.5, high, read-only) and `Explore` (Haiku 5.5, replaces the built-in one and skips CLAUDE.md). The rules are in the global CLAUDE.md and `~/.claude/docs/subagents.md`; this project's specifics are in CLAUDE.md "Workflow". The owner dropped the ask-before-spawning rule. The first, project-only copies in `.claude/agents/` were removed so they can't override the global ones.
- `CLAUDE.md` went from 68 KB to 12 KB. Its feature notes moved unchanged into `.claude/docs/` (gitignored, like CLAUDE.md), the to-do list into `.claude/docs/todo.md`, and a full copy of the old file is in `.claude/docs/old/`. Older handout sections moved unchanged into `handout-archive.md`; the gotchas now live in `.claude/docs/testing-and-gotchas.md`.
- **First real `builder` run worked (2026-10-13)**: review items 2 to 6 on `fix/fe-review-items`, about 13 minutes. It followed the brief, ran the checks, committed without merging and wrote a useful report. Two lessons: a brief that names one file gets only that file (it left the same bug in Profile when told "Friends"), so name every place; and its process cleanup killed every `vite.js` by name, which can stop the owner's dev server (now a note in `testing-and-gotchas.md`; say "stop only what you started" in briefs).

## Where to pick up (read this first)
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
