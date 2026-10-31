import { tomorrowSleepPlan } from "@/utils/sleepPlan";

// From this hour on, a heavy morning tomorrow is worth a word about bedtime.
const BEDTIME_NUDGE_HOUR = 18;

// The one thing the Next step card says, the first that applies: a check-in that is due, a bedtime nudge
// before an early class, the best idea for moving a deadline, the top tip. `kind` is "checkin", "sleep",
// "move", "tip" or "empty" (nothing to suggest).
export function nextStepFor({ prompt, work, moves, now }) {
  if (prompt) return { kind: "checkin", prompt };
  const sleep = now.getHours() >= BEDTIME_NUDGE_HOUR ? tomorrowSleepPlan({ week: work.week, profile: work.profile }) : null;
  if (sleep) return { kind: "sleep", sleep };
  if (moves.visible[0]) return { kind: "move", idea: moves.visible[0] };
  const [tip] = work.insights.tips ?? [];
  if (tip) return { kind: "tip", tip };
  return { kind: "empty" };
}
