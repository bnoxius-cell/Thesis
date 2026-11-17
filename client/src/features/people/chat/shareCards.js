import { CalendarDays, FileText, ListChecks } from "lucide-react";
import { taskDueText } from "@/features/details/detailText";
import { saveFromMessage } from "@/shared/api/groups";
import { importSharedTimetable } from "@/shared/api/schedules";
import { importSharedTask } from "@/shared/api/tasks";
import { dueChip, dueWords } from "@/shared/lib/dueChip";

const entriesText = (entries) => {
  const word = entries.every((e) => e.kind === "class") ? ["class", "classes"] : ["entry", "entries"];
  return `${entries.length} ${entries.length === 1 ? word[0] : word[1]}`;
};

// Due soon reads as a warning, past due as a problem, anything further out as plain information.
const dueTone = (days) => (days < 0 ? "danger" : days < 7 ? "watch" : "neutral");

// How each shared card looks and what its button does, by message type (Figma SH-2; the timetable keeps 64:302).
//   field        where the snapshot sits on the message
//   icon         the lucide icon on the card's tile
//   inline       the timetable's older layout: icon beside the name, no kind label, a chip once added
//   eyebrow      the kind label above the name (every layout but inline)
//   title, sub   the card's two text lines, from the message (and who sent it, for the timetable)
//   chip         optional { label, tone } under the text, from the message and the current time
//   note         optional line above the button
//   own          true when the sender's own card says "Shared by you." in place of the button
//   action, busy, done      the button's label, its label while working, and the label once it is in
//   toast        what the toast says after a successful add
//   add          async (plan, message) => the request's { data } or { error }; `plan` is { groupId, onAdded }
//   alreadyIs409 a 409 means the student already has it, so the card just shows the done state
//   open         optional { label, to(saved), fallback } link on the done row; `saved` is what the save answered
export const SHARE_CARDS = {
  schedule: {
    field: "schedule",
    icon: CalendarDays,
    inline: true,
    title: (m) => m.schedule.title,
    sub: (m, by) => `${entriesText(m.schedule.entries ?? [])}, shared by ${by}`,
    action: "Add to my plan",
    busy: "Adding...",
    done: "In your plan",
    toast: "Added to your plan.",
    add: (plan, m) => importSharedTimetable(plan.groupId, m._id, m.schedule.entries.map((e) => e._id)),
  },
  task: {
    field: "task",
    icon: ListChecks,
    eyebrow: "Task",
    own: true,
    title: (m) => m.task.title,
    sub: (m) => [
      m.task.dueDate && `Due ${taskDueText(m.task)}`,
      m.task.hours > 0 && `about ${Number(m.task.hours.toFixed(1))} h`,
    ].filter(Boolean).join(" · "),
    chip: (m, now) => m.task.dueDate && { label: dueWords(m.task.dueDate, now), tone: dueTone(dueChip(m.task.dueDate, now).days) },
    action: "Add to my plan",
    busy: "Adding...",
    done: "In your plan",
    toast: "Added to your plan.",
    alreadyIs409: true,
    add: (plan, m) => importSharedTask(m.task.shareTag),
  },
  reviewer: {
    field: "reviewer",
    icon: FileText,
    eyebrow: "Reviewer",
    own: true,
    title: (m) => m.reviewer.title,
    sub: (m) => [m.reviewer.course, `${m.reviewer.questionCount} ${m.reviewer.questionCount === 1 ? "question" : "questions"}`].filter(Boolean).join(" · "),
    note: "The questions open after you save it.",
    action: "Save to Study",
    busy: "Saving...",
    done: "Saved to Study",
    toast: "Saved to your Study.",
    alreadyIs409: true,
    add: (plan, m) => saveFromMessage(plan.groupId, m._id),
    open: { label: "Open", to: (saved) => `/study/reviewers/${saved._id}`, fallback: "/study/practice" },
  },
};
