import { buildWeek } from "./workload";
import { toISODate, addDays, fromISODate } from "./scheduleUtils";

// Suggests doing a task earlier when the coming week does not fit. Due dates never move: for each
// open task it tries finishing it on an earlier day (today up to the day before the deadline, never a
// day off), re-plans the week, and keeps the idea that takes the most pressure off, preferring a later
// start. Nothing is changed here: the dashboard shows the idea and the student decides when to start.

const WEEK_DAYS = 7;
// An idea has to take at least this many hours of overload off the week to be worth suggesting.
const MIN_RELIEF = 0.5;
// Each day earlier costs a little, so a later start wins over an earlier one with similar relief.
const SHIFT_COST = 0.15;
// Important tasks are the last ones to suggest changing.
const IMPORTANCE_COST = 0.1;

const round1 = (n) => Math.round(n * 10) / 10;
const overloadOf = (days) => days.reduce((sum, d) => sum + Math.max(0, d.load - d.capacity), 0);
const dateOnly = (value) => String(value).slice(0, 10);
const dayDiff = (from, to) => Math.round((to - from) / 86400000);
const weekday = (iso) => fromISODate(iso).toLocaleDateString("en-US", { weekday: "long" });

// Someone who is stressed, low in well-being or looking at a heavy week gets help sooner and
// more of it: a smaller overload is enough to speak up, and up to three ideas are offered.
export function isStrained({ band, pssScore, whoScore }) {
  return band === "Heavy Workload"
    || band === "Critical Overload"
    || (pssScore !== null && pssScore !== undefined && pssScore >= 27)
    || (whoScore !== null && whoScore !== undefined && whoScore < 50);
}

// tasks       the student's open tasks (as the API sends them)
// fixedTasks  work that cannot move, such as exam preparation
// overview    the server's week overview, so classes and exams are already in the plan
export function suggestMoves({ tasks, fixedTasks = [], profile, overview, strained = false, now = new Date() }) {
  const threshold = strained ? 0.25 : 1;
  const limit = strained ? 3 : 2;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const layout = (list) => buildWeek([...list, ...fixedTasks], profile, overview, now);
  let current = tasks
    .filter((t) => !t.isCompleted)
    .map((t) => ({ ...t, dueDate: dateOnly(t.dueDate) }));
  const moved = new Set();
  const suggestions = [];

  for (let round = 0; round < limit; round += 1) {
    const base = layout(current);
    const baseOverload = overloadOf(base);
    if (baseOverload <= threshold) break;

    // The day that is most over what it can hold, for the explanation.
    const worst = base.reduce((a, d) => (d.load - d.capacity > a.load - a.capacity ? d : a), base[0]);

    let best = null;
    for (const task of current) {
      if (moved.has(task._id) || Number(task.hours) <= 0) continue;
      if (Number(task.importance) >= 5 && !strained) continue;

      // Due today or overdue: there is no earlier day to offer.
      const dueIndex = dayDiff(today, fromISODate(task.dueDate));
      if (dueIndex <= 0) continue;
      for (let i = 0; i < Math.min(dueIndex, WEEK_DAYS); i += 1) {
        const doOn = toISODate(addDays(today, i));
        // Not onto a day off.
        if (base.find((d) => d.key === doOn)?.holiday) continue;
        const trial = current.map((t) => (t._id === task._id ? { ...t, dueDate: doOn } : t));
        const relief = baseOverload - overloadOf(layout(trial));
        if (relief < MIN_RELIEF) continue;
        const daysEarlier = dueIndex - i;
        const score = relief - SHIFT_COST * daysEarlier - IMPORTANCE_COST * Number(task.importance || 3);
        if (!best || score > best.score) best = { task, doOn, daysEarlier, relief, score };
      }
    }
    if (!best) break;

    const dayName = weekday(worst.key);
    const over = round1(worst.load - worst.capacity);
    suggestions.push({
      taskId: best.task._id,
      title: best.task.title,
      course: best.task.course,
      dueDate: best.task.dueDate,
      doOn: best.doOn,
      daysEarlier: best.daysEarlier,
      relief: round1(best.relief),
      why: strained
        ? `You're carrying a lot right now. Doing this one earlier takes about ${round1(best.relief)}h off ${dayName}. The deadline stays the same.`
        : `${dayName} has ${over}h more than you can fit. Doing this one earlier evens it out. The deadline stays the same.`,
    });
    moved.add(best.task._id);
    current = current.map((t) => (t._id === best.task._id ? { ...t, dueDate: best.doOn } : t));
  }
  return suggestions;
}

// "Do "Report" today instead of Friday": the one place the words for an idea live. A deadline a week or
// more away reads as a date ("Nov 24"), since a weekday name would be ambiguous.
export function ideaTitle(idea, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const doIndex = dayDiff(today, fromISODate(idea.doOn));
  const dueIndex = dayDiff(today, fromISODate(idea.dueDate));
  const when = doIndex <= 0 ? "today" : doIndex === 1 ? "tomorrow" : `on ${weekday(idea.doOn)}`;
  const due = dueIndex === 1
    ? "tomorrow"
    : dueIndex >= WEEK_DAYS
      ? fromISODate(idea.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : weekday(idea.dueDate);
  return `Do "${idea.title}" ${when} instead of ${due}`;
}
