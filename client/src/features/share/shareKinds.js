import { BookOpen, CalendarDays, FileText, Layers, ListChecks } from "lucide-react";
import { taskDueText } from "@/features/details/detailText";

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// What the student can post in a group, by kind. Pure data, so a later batch adds subjects, decks and files
// with one entry each.
//   icon    the lucide icon in the dialog's item box
//   blurb   the line under the dialog's title
//   body    the request body for POST /api/groups/:groupId/messages (see shareToGroup)
//   line    the item box's second line, built from what the page has at hand
//   title   the item box's first line
export const SHARE_KINDS = {
  task: {
    icon: ListChecks,
    blurb: "Your groupmates get a copy to add to their own plan. Later changes stay with you.",
    body: (task) => ({ taskId: task._id }),
    title: (task) => task.title,
    line: (task) => ["Task", task.dueDate && `Due ${taskDueText(task)}`].filter(Boolean).join(" · "),
  },
  timetable: {
    icon: CalendarDays,
    blurb: "Your groupmates get a copy to add to their own plan. Later changes stay with you.",
    body: (timetable) => ({ scheduleId: timetable._id }),
    title: (timetable) => timetable.title,
    line: (timetable) => `Timetable · ${count(timetable.entryCount ?? 0, "entry", "entries")}`,
  },
  reviewer: {
    icon: FileText,
    blurb: "Your groupmates can save a copy to their own Study. Later changes stay with you.",
    body: (reviewer) => ({ reviewerId: reviewer._id }),
    title: (reviewer) => reviewer.title,
    line: (reviewer) => `Reviewer · ${count(reviewer.questionCount ?? 0, "question", "questions")}`,
  },
  subject: {
    icon: BookOpen,
    blurb: "Your groupmates can add it to their own Study, with its class times. Later changes stay with you.",
    body: (subject) => ({ subjectId: subject._id }),
    title: (subject) => subject.name,
    line: (subject) => ["Subject", subject.code].filter(Boolean).join(" · "),
  },
  deck: {
    icon: Layers,
    blurb: "Your groupmates can save a copy to their own Study. Later changes stay with you.",
    body: (deck) => ({ deckId: deck.id }),
    title: (deck) => deck.title,
    line: (deck) => `Flashcard deck · ${count(deck.cards ?? 0, "card", "cards")}`,
  },
};
