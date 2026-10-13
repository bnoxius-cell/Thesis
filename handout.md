# Session handout

Main session only: read this first after a `/clear` (subagents skip it unless their brief says otherwise). It's the short "where we left off" note: current state, open items and next steps. Rules are in `CLAUDE.md`, feature notes in `.claude/docs/`, older session notes in `handout-archive.md`.

Last updated: 2026-10-13. **All frontend batches (FE-1 to FE-6) are done and merged into `main`, and Opus has reviewed FE-4 to FE-6 (findings below, nothing fixed yet).** 450 server tests pass, client builds clean. The subagent workflow is set up (next section). Branch from `main` for each batch.

## Subagent workflow (set up 2026-10-13)
- Agents in `.claude/agents/` (committed): `builder` (Sonnet 5.5, high effort), `code-reviewer` (Opus 5.5, high, read-only) and `Explore` (Haiku 5.5, replaces the built-in one and skips CLAUDE.md). When and how to use them: CLAUDE.md "Workflow". The owner dropped the ask-before-spawning rule.
- `CLAUDE.md` went from 68 KB to 12 KB. Its feature notes moved unchanged into `.claude/docs/` (gitignored, like CLAUDE.md), the to-do list into `.claude/docs/todo.md`, and a full copy of the old file is in `.claude/docs/old/`. Older handout sections moved unchanged into `handout-archive.md`; the gotchas now live in `.claude/docs/testing-and-gotchas.md`.
- Not tried yet: a real builder run. Claude Code loads the agents after a restart (the `.claude/agents/` folder is new). A good first run: review items 2 to 6 below as one fix list on one UI branch.

## Opus review of FE-4 to FE-6 (2026-10-13)
Scope: commits `438931b` (FE-4), `c068a31` (FE-5), `ee5510a` (FE-6). Re-ran: 450/450 server tests, client build (645 KB chunk, as before), lint on the changed files (only the 3 known `set-state-in-effect` errors). Nothing was tried in a browser.
- **Fine as is**: friend routes (only the two people on a request can drop it, bad ids 404, tested), emails gone from friend lists, pace logic matches the owner's decision and is tested, no raw colors added, none of the deleted CSS is still used, the reset form posts `{ email, otp, password }` and its "20 minutes" matches the server, `LEGAL_VERSION` and `LEGAL_UPDATED` both bumped.
- **1 (Medium, do before the panel)**: FE-5 put the forgot-password screen live before Batch 1's server half. Now reachable from the UI: the server accepts any non-empty new password (only the client checks 8); if the "password changed" email fails, the password is already changed but the student sees an error, and a retry says "Invalid OTP" because the code was cleared; no attempt limit on codes (S1); the forgot screen toasts "User not found." (S6). Fix = Batch 1. Ask the owner S6 first.
- **2 (Low, phones)**: on 720px and under, the sticky top bar is 56px but section `scroll-margin-top` is 24px, so hash links land with the section heading under the bar: Me (`#help` from the footer, `#notifications` from the Notifications page, `#appearance` from `/settings`), Wellbeing (`#checkins`, `#how`) and the legal page sections. Fix: in the 720px block, `scroll-margin-top: calc(56px + env(safe-area-inset-top) + var(--space-3))` on `.me-sections > *`, the Wellbeing sections and `.legal-doc section`.
- **3 (Low)**: Me scrolls to the hash once on mount, before `NotificationPreferences` has loaded. When that panel fills in, everything below it (`#checkins`, `#privacy`, `#help`) moves down. Chrome's scroll anchoring probably hides it; Safari may not. Fix: same as Wellbeing (scroll again once the panel has loaded, e.g. an `onReady` prop).
- **4 (Low, thesis accuracy)**: About lists the seven weighted parts of the score but not the point adjustments (exam within 7 days +8 or within 2 days +15, overdue tasks +3 each up to +10, pace +10 / -10). One sentence fixes it.
- **5 (Nits)**: Add friend from `PublicProfile` / `MemberDialog` toasts "Friend request sent." even when the server auto-accepted (use `data.accepted`); the tab title says "Me" on another student's profile (`pageTitles.js`); Friends copies Profile's fallback code (`_id.slice(0, 6)`), which isn't a real friend code (rare: the pre-save hook gives everyone a `profileTag`).
- **6 (Docs)**: `PRODUCT.md` still says the logo is `logo.svg` (the Impeccable skill reads it); `system-review.md` R3 and the logo half of P1 are done by FE-6 but not ticked.

## Where to pick up (read this first)
- Frontend is finished and reviewed. Next: fix review items 2 to 6 (small, one UI branch), then Batch 1 (item 1, needs the S6 answer), then auth Batch 5 (Opus review before merging); Batch 4 (task share tags); Batch 6 rest; Batch 10 (delete-user script); Batch 11 (code splitting, 645 KB bundle). Full list in `system-review.md`.
- Owner to-do: fill in `client/src/utils/helpContacts.js` and the About team names (visible placeholders), real phone pass on the deployed site, say whether to record a DESIGN.md, manual reviewer tests, real Google sign-in on the live site.
- Not verified: the forgot-password flow end to end (needs real email), a real phone, the Chrome extension (it never connected this session; headless Chrome was used).
- Lint has a few known `set-state-in-effect` / `react-refresh` errors, an existing pattern, left alone.

## Not verified yet (needs a human)
- **Actual OS push alert.** Chrome's permission prompt can't be clicked by automation. Click "Turn on" under "On this device" on the Notifications page, allow it, then have another account post in a shared group while the tab is in the background or closed.
- **Phone.** Needs the deployed HTTPS site. On iPhone: Add to Home Screen first.
- **Web Push in production.** Nobody has confirmed that `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are set on Render (an old "Next up" item, now in `handout-archive.md`). Without them the inbox still works but phone and PC alerts stay off. Check the Render dashboard.

## Owner's standing rules (from global CLAUDE.md, easy to forget)
- Branch before editing code. When starting new, distinct work, commit, push and merge the old branch into `main` automatically, but never delete branches.
- Subagents: spawn them without asking (owner's call, 2026-10-13), the way CLAUDE.md "Workflow" describes.
- **`frontend-plan.md` exists since 2026-10-12.** UI work follows it. The only design questions to ask are the ones in its Open list.
- No `Co-Authored-By` lines in commits or PRs.
- Docs: after each task, put feature facts in the matching `.claude/docs/` file (CLAUDE.md only gets rules and pointers), tick `.claude/docs/todo.md` and the plan, and put anything still in progress in `handout.md`.
- Writing style: plain sentences, no em-dashes as connectors, no "not just X, it's Y". No emojis in UI (use lucide-react).

## Gotchas
Moved to `.claude/docs/testing-and-gotchas.md`: UI harness quick start, headless Chrome, Chrome extension quirks, ports.
