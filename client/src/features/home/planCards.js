import { dueChip } from "@/shared/lib/dueChip";
import { effortLabel } from "@/shared/lib/effort";
import { subjectTone } from "@/shared/lib/subjectTone";
import { taskDueIso } from "@/utils/scheduleUtils";

const MAX_CARDS = 4;

// The cards under "Plan for you": what is coming after today (today's own tasks are in the Today hero),
// tasks and the next exam together, soonest first. `tasks` are open tasks that carry `daysLeft`
// (useWorkload's enrichedTasks); `exam` is the next exam from the timetable or undefined.
export function planCards({ tasks, exam, subjectsById, now }) {
  const cards = tasks
    .filter((task) => task.daysLeft >= 1)
    .map((task) => ({
      id: task._id,
      date: taskDueIso(task.dueDate),
      label: task.course || "Task",
      tone: subjectTone(subjectsById.get(task.subject)?.color),
      title: task.title,
      when: dueChip(task.dueDate, now).label,
      size: effortLabel(task.hours),
    }));

  if (exam && exam.daysLeft >= 1) {
    cards.push({
      id: `exam:${exam.date}:${exam.title}`,
      date: exam.date,
      label: "Exam",
      tone: "watch",
      title: exam.title,
      when: dueChip(exam.date, now).label,
      size: null,
    });
  }

  return cards.sort((a, b) => a.date.localeCompare(b.date)).slice(0, MAX_CARDS);
}
