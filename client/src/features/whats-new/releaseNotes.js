// What changed for students, newest first. Order is the array order, never the id text.
// Write one entry per release that a student would notice. Rules for the wording: one sentence per
// item, 140 characters at most, talk to the student ("you", "your"), say what they'll notice, no
// dashes, no jargon, no emoji, 1 to 6 items. A second release on the same day gets a "-2" id.
// server/tests/releaseNotes.test.js checks the shape.
export const RELEASE_NOTES = [
  {
    id: "2026-11-14-2",
    title: "Flashcards",
    items: [
      { tag: "new", text: "Make flashcards from a reviewer's key terms, or write your own, and find them in Practice." },
      { tag: "new", text: "Review the cards due today. Tap Got it or Still learning and the ones you miss come back sooner." },
      { tag: "new", text: "Each deck has its own page where you can add, edit and delete cards." },
      { tag: "new", text: "A subject's Practice tab now holds its reviewers and its flashcards." },
      { tag: "improved", text: "On your phone, drag any bottom sheet down to close it." },
    ],
  },
  {
    id: "2026-11-14",
    title: "Question types and easier adding",
    items: [
      { tag: "new", text: "Reviewers can now ask true or false, identification, fill in the blank and enumeration questions, or a mix of all of them." },
      { tag: "new", text: "There's one Add button at the top of every page, for tasks, classes, events, people and files." },
      { tag: "new", text: "Tap a day in Week, Month or Home to see that whole day in one window." },
      { tag: "new", text: "Add a class, exam, event or activity right from Plan." },
      { tag: "improved", text: "Rename, delete or leave a timetable from the More button next to the switcher." },
      { tag: "improved", text: "Month view shows your events and activities like Week does." },
    ],
  },
];

export const NOTE_TAGS = { new: "New", improved: "Improved", fixed: "Fixed" };
