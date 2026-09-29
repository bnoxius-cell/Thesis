import { buildWeek } from "./workload";
import { toISODate, addDays, fromISODate } from "./scheduleUtils";

// Suggests moving a task's due date when the coming week does not fit. It tries pushing each
// open task back a day at a time, re-plans the week, and keeps the smallest move that takes the
// most pressure off. Nothing is changed here: the dashboard shows the idea and the student
// decides, since only they know whether a deadline can really move.

const MAX_SHIFT_DAYS = 10;
// A move has to take at least this many hours of overload off the week to be worth suggesting.
const MIN_RELIEF = 0.5;
// Each day of delay costs a little, so a shorter move wins over a longer one with similar relief.
const SHIFT_COST = 0.15;
// Important tasks are the last ones to suggest moving.
const IMPORTANCE_COST = 0.1;

const round1 = (n) => Math.round(n * 10) / 10;
const overloadOf = (days) => days.reduce((sum, d) => sum + Math.max(0, d.load - d.capacity), 0);
const dateOnly = (value) => String(value).slice(0, 10);
const weekday = (iso) => fromISODate(iso).toLocaleDateString("en-US", { weekday: "long" });

// Someone who is stressed, low in well-being or looking at a heavy week gets help sooner and
// more of it: a smaller overload is enough to speak up, and up to three moves are offered.
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

      const from = fromISODate(task.dueDate);
      const origin = from < today ? today : from;
      for (let shift = 1; shift <= MAX_SHIFT_DAYS; shift += 1) {
        const target = toISODate(addDays(origin, shift));
        // Not onto a day off.
        if (base.find((d) => d.key === target)?.holiday) continue;
        const trial = current.map((t) => (t._id === task._id ? { ...t, dueDate: target } : t));
        const relief = baseOverload - overloadOf(layout(trial));
        if (relief < MIN_RELIEF) continue;
        const score = relief - SHIFT_COST * shift - IMPORTANCE_COST * Number(task.importance || 3);
        if (!best || score > best.score) best = { task, target, shift, relief, score };
      }
    }
    if (!best) break;

    const dayName = weekday(worst.key);
    const over = round1(worst.load - worst.capacity);
    suggestions.push({
      taskId: best.task._id,
      title: best.task.title,
      course: best.task.course,
      fromDate: best.task.dueDate,
      toDate: best.target,
      shift: best.shift,
      relief: round1(best.relief),
      why: strained
        ? `You're carrying a lot right now. More room on this one takes about ${round1(best.relief)}h of pressure off ${dayName}.`
        : `${dayName} is ${over}h more than you can fit. Moving this deadline evens the week out.`,
    });
    moved.add(best.task._id);
    current = current.map((t) => (t._id === best.task._id ? { ...t, dueDate: best.target } : t));
  }
  return suggestions;
}
