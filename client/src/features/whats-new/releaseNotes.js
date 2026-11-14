// What changed for students. One file per DAY in ./notes, named by its date: `2026-11-14.js`. A second
// release the same day goes into that day's file (add its items there), never a new `-2` file. The file
// name is the entry's id, so nothing else needs editing: this module finds every file in the folder and sorts them newest first.
//
// A note file is `export default { title, items: [{ tag, text }] }`.
// Wording: one sentence per item, 140 characters at most, talk to the student ("you", "your"), say what they'll
// notice, no dashes, no jargon, no emoji, 1 to 6 items. Add the note BEFORE every push to `production`.
// server/tests/releaseNotes.test.js checks the shape.
const files = import.meta.glob("./notes/*.js", { eager: true, import: "default" });

export const RELEASE_NOTES = Object.entries(files)
  .map(([path, note]) => ({ id: path.slice("./notes/".length, -".js".length), ...note }))
  .sort((a, b) => b.id.localeCompare(a.id));

export const NOTE_TAGS = { new: "New", improved: "Improved", fixed: "Fixed" };
