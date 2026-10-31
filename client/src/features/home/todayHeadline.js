import { formatTime } from "@/utils/scheduleUtils";

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const atPlace = (entry) => (entry.location ? ` · ${entry.location}` : "");

function timeLeft(entry, now) {
  const left = Math.max(toMinutes(entry.endTime) - (now.getHours() * 60 + now.getMinutes()), 1);
  return left >= 60 ? `${Math.floor(left / 60)} h ${left % 60 ? `${left % 60} min ` : ""}left` : `${left} min left`;
}

// The big line at the top of the Today hero: what is on now, or next, or what is due. null when
// there is nothing to say (the hero shows its one-line empty text instead).
export function todayHeadline({ focus, tasks, now }) {
  const [current] = focus.happeningNow;
  if (current) return { title: `Now: ${current.title}`, detail: `${timeLeft(current, now)}${atPlace(current)}` };
  const [upcoming] = focus.laterToday;
  if (upcoming) return { title: `Next: ${upcoming.title}`, detail: `${formatTime(upcoming.startTime)}${atPlace(upcoming)}` };
  if (tasks.length) {
    const n = tasks.length;
    return { title: `${n} ${n === 1 ? "task" : "tasks"} to do today`, detail: `Start with ${tasks[0].title}.` };
  }
  return null;
}

const QUIET = {
  morning: "A clear morning. A good time to get ahead, or just to breathe.",
  afternoon: "Nothing on and nothing due. Enjoy the breathing room.",
  evening: "Nothing left for today. You can switch off.",
  night: "Nothing left for today. Time to rest.",
};

// The single line shown when the day has nothing in it.
export function todayEmptyText({ focus, today, isNewUser }) {
  if (isNewUser) return "Add your classes or a task, and today starts to fill in.";
  if (today.holiday) return "A day off, and nothing due. Enjoy it.";
  if (focus.caughtUp) return "You're all caught up. Enjoy it, or use the time to plan ahead.";
  return QUIET[focus.phase];
}
