// The one short line the day window opens with. About how full the day is, never about scores: six fixed
// lines, picked by whether it is a day off, empty, light, steady, heavy or full. Pure, so a server test
// can import it (server/tests/cheerLine.test.js).
//   day  { holiday, entries, tasks, load } as buildDay (features/plan/planDays.js) gives it
const FULL_AT = 6; // this many entries and tasks makes a full day

export const CHEER_LINES = {
  off: "A day off. Rest is part of the plan too.",
  empty: "Nothing planned. Get ahead a little, or just rest.",
  light: "A light one. Plenty of room to breathe.",
  steady: "A steady day. One thing at a time.",
  heavy: "A lot lands today. Pick the first thing and start there.",
  full: "A full one. Water and a real lunch will help.",
};

export function cheerLine(day) {
  const count = day.entries.length + day.tasks.length;
  if (day.holiday) return CHEER_LINES.off;
  if (count === 0) return CHEER_LINES.empty;
  if (count >= FULL_AT) return CHEER_LINES.full;
  if (day.load === "heavy") return CHEER_LINES.heavy;
  return count <= 2 ? CHEER_LINES.light : CHEER_LINES.steady;
}
