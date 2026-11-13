// What the global "+ Add" menu offers and what it says afterwards. Pure, with relative imports only (no "@/"
// alias), so a server test can import it (server/tests/addOptions.test.js). Icons are mapped in GlobalAddButton.
import { planDayHref, subjectHref, taskHref } from "../../../features/details/itemLinks.js";
import { KIND_LABELS, addDays, toISODate } from "../../../utils/scheduleUtils.js";

// Copy is from the Figma frames (219:3284 AddMenuRow). `icon` names the icon, `group` where it lists first.
export const ADD_OPTIONS = [
  { kind: "task", title: "Task", hint: "Something to finish by a date", icon: "tasks", group: "plan" },
  { kind: "class", title: "Class", hint: "Repeats on the days you pick", icon: "calendar-plus", group: "plan" },
  { kind: "exam", title: "Exam", hint: "One date, with study time before it", icon: "clipboard-check", group: "plan" },
  { kind: "event", title: "Event", hint: "One day, or every week", icon: "flag", group: "plan" },
  { kind: "activity", title: "Activity", hint: "Org, sports or work you do each week", icon: "shapes", group: "plan" },
  { kind: "subject", title: "Subject", hint: "A course for your tasks and notes", icon: "subjects", group: "study" },
  { kind: "reviewer", title: "Reviewer", hint: "Practice questions from your notes", icon: "reviewers", group: "study" },
];

const GROUP_HEADINGS = { plan: "Plan", study: "Study" };

// Study and everything under it lists Study first; every other page lists Plan first (Home counts as Plan).
export const addGroupFor = (pathname) => (pathname === "/study" || pathname.startsWith("/study/") ? "study" : "plan");

// The menu's two sections: the page's own group, then everything else.
export function addSections(pathname) {
  const group = addGroupFor(pathname);
  return [
    { heading: GROUP_HEADINGS[group], rows: ADD_OPTIONS.filter((option) => option.group === group) },
    { heading: "Everything else", rows: ADD_OPTIONS.filter((option) => option.group !== group) },
  ];
}

// The day a saved entry shows up first: its own date, or for a weekly entry the next day on or after
// `today` whose Date#getDay is in `days`.
function firstDay(entry, today) {
  if (entry.date) return entry.date;
  for (let ahead = 0; ahead < 7; ahead += 1) {
    const day = addDays(today, ahead);
    if (entry.days.includes(day.getDay())) return toISODate(day);
  }
  return toISODate(today);
}

// The toast after a save: its message and where "View" goes. `result` is the saved task or subject, `{ entry }`
// (the saved entry's date or days) for class, exam, event and activity, and nothing for a reviewer, which the
// server is still writing.
export function addedToast(kind, result, today = new Date()) {
  if (kind === "task") return { message: "Task added to Plan", href: taskHref(result._id) };
  if (kind === "subject") return { message: "Subject added to Study", href: subjectHref(result._id) };
  if (kind === "reviewer") return { message: "Making your reviewer", href: "/study/practice" };
  return {
    message: `${KIND_LABELS[kind]} added to Plan`,
    href: planDayHref(firstDay(result.entry, today), today),
  };
}
