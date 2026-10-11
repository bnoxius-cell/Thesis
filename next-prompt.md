# Next prompt (saved 2026-10-11, before a /clear)

The owner asked for this to be the next task after the AI reviewer testing pass. Do it on a new branch from `main`.

## The prompt, as the owner wrote it

> change the confirm dialogue box. like mark as done in all tasks section in the dashboard, and look for other buttons that have the default dialogue box. use the ui for the current delete or edit buttons. Add a tutorial option at the bottom right corner for users for the important pages like schedule or reviewer and dashboard. make an md file that for every change in structure or design also do for mobile view. use my chrome for testing.

Note: in an earlier message the same session the owner said to skip the confirm dialog part, but their last message included it again as part of this prompt, so it's in. If unsure, ask once.

## What it means, broken down

1. **Replace the browser's default dialogs with the app's own dialog.** Use `client/src/components/ConfirmDialog.jsx` (already used for reviewer delete and ending a Learning Mode session; `tone="danger"` for destructive actions). Found on 2026-10-11:
   - `client/src/components/TaskBoard.jsx:70`: `window.confirm("✅ Mark this task as done?...")` (the "mark as done" in the dashboard's All tasks section)
   - `client/src/components/TaskBoard.jsx:84`: `window.prompt("Copy this task code:", shareTag)` (needs an in-app way to show and copy the code)
   - `client/src/pages/Friends.jsx:86`: `window.confirm("Remove this friend?")`
   - Search again for `window.confirm`, `window.alert`, `window.prompt`, `confirm(`, `alert(` before starting.
2. **Tutorial button, bottom-right corner**, on the important pages: Dashboard, Schedule, Reviewers. A small help button that opens a short step-by-step guide to that page. Notes: toasts sit top-right; on phones the sidebar is a left icon rail with a menu button, so bottom-right is free, but keep clear of page content and the phone's home bar (safe-area inset). No emojis in UI, use lucide-react icons. Follow the design system in CLAUDE.md. Don't ask design questions, only architecture ones (for example, whether "tutorial seen" should be saved per account on the server or per browser).
3. **An md file with the rule: every change to structure or design must also be done for mobile view.** Put it in the project and add a one-line pointer in `CLAUDE.md` so it's read before any UI work.
4. **Test in the owner's own Chrome** (the Claude in Chrome extension, `mcp__claude-in-chrome__*` tools), not headless Chrome. Load the tools in one ToolSearch call, start with `tabs_context_mcp`, open a new tab. Port 5000 is the owner's real dev server with the real database: create a throwaway test account, or ask. Check desktop and phone width (the resize tool doesn't work here; use a fixed-width iframe probe, see handout.md Gotchas).
