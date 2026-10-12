Start building the frontend revamp from `frontend-plan.md`. Every open decision is answered (section 8).

Before anything else, read `handout.md`, `frontend-plan.md` (all of it, especially sections 6, 7, 11 and 12) and `mobile-rules.md`.

Do these in order, one branch each, following the rules at the top of `frontend-plan.md` section 12:
1. **FE-1** `design/tokens-and-shell`: tokens and color roles (red off buttons and labels), dark-mode surfaces, PageHeader / Tabs / EmptyState, the new navigation shell with the phone bottom bar and the bell, slim app footer, the redirects and the 404 page.
2. **FE-2** `redesign/today`: the `useWorkload()` hook, Schedule's Week / Tasks / Days off tabs with the task board moved there, compact task rows, the new Today page, the setup checklist, and the bedtime suggestion (`sleepPlan.js` with tests).
3. **system-review.md Batch 3** `fix/server-checks` (server only, with tests). S5 matters most: the server scores check-ins itself before FE-3 builds the result screen.

For each batch:
- Check the changed pages at 320, 375, 768 and 1280px, light and dark, against the in-memory test harness (handout.md, Gotchas: API on 5070, Vite on 5174). Never use port 5000.
- `npx vite build` passes, lint doesn't get worse, `npm test` in `server/` passes, and new utils have tests in `server/tests/`.
- Tick the batch's boxes in `frontend-plan.md` (and `system-review.md` for Batch 3), then commit, push and merge into `main` before starting the next batch. No `Co-Authored-By` or `Claude-Session` lines. Never delete branches.

Don't start system-review Batch 1 or 5 in this session (auth; they need an Opus review before merging). Don't spawn subagents without asking. If the plan and the code disagree, tell me instead of guessing.

When all three are merged: update `CLAUDE.md` (what changed) and `handout.md` (where things stand and what's next: SR Batch 7 Modal, then FE-3), then delete this file.
