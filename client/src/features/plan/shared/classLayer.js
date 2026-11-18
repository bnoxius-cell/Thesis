import { WEEKDAYS } from "@/utils/scheduleUtils";
import { shortDay, timeSpan } from "@/features/details/detailText";

// Words and shapes for a member's own layer over a shared timetable (plan 40, 2.4). Pure: no React, no requests.

const CHIP_TONES = { follow: "neutral", hidden: "neutral", custom: "accent" };

// The small chip that says what the student's choice is on a class of a shared timetable ("Follows the group",
// "Not taking", "Yours"), or null for an entry that has no layer (their own timetable's).
export function layerChip(entry) {
  const tone = CHIP_TONES[entry.myChoice];
  if (!tone) return null;
  const label = {
    follow: entry.group ? "Follows the group" : "Follows the timetable",
    hidden: "Not taking",
    custom: "Yours",
  }[entry.myChoice];
  return { label, tone };
}

// Where the shared class lives, whichever entry the student opened. In their week a class they customized is
// their own copy (`customOf` names the shared class); on the shared timetable itself it is the shared class.
//   scheduleId, entryId  the shared timetable and its class (what every layer call is addressed to)
//   choice               "follow" | "hidden" | "custom"
//   notice               "changed" | "removed" | null
//   isCopy               true when the entry opened is the student's own copy
// Null for an entry with no layer.
export function layerRef(entry) {
  if (!entry.myChoice) return null;
  const shared = entry.customOf ?? { scheduleId: entry.scheduleId, entryId: entry.entryId };
  return {
    scheduleId: shared.scheduleId,
    entryId: shared.entryId,
    title: entry.title,
    choice: entry.myChoice,
    notice: entry.notice ?? null,
    group: entry.group ?? null,
    isCopy: Boolean(entry.customOf),
  };
}

// ---- When a class meets ------------------------------------------------------------------------------------

const dayText = (entry) =>
  entry.date ? shortDay(entry.date) : WEEKDAYS.filter((day) => entry.days?.includes(day.value)).map((day) => day.short).join(", ");

const startText = (entry) => entry.startTime.replace(/^0/, "");

// "Mon, Wed 7:00": when a class starts.
export const whenText = (entry) => `${dayText(entry)} ${startText(entry)}`.trim();

// "Mon, Wed 8:00 to 9:30 am": when a class starts and ends.
export const spanText = (entry) => `${dayText(entry)} ${timeSpan(entry.startTime, entry.endTime)}`.trim();

// ---- The words of a change notice --------------------------------------------------------------------------

const quoted = (title) => `"${title}"`;

// What a notice says about a class the shared timetable changed or removed under the student's own copy.
// `shared` and `mine` are the two entries when they are known; without them (or when the times read the same)
// the line stays general. `who` is "The group" or "The timetable".
export function noticeText(notice, title, who, shared, mine) {
  if (notice === "removed") return `${who} removed ${quoted(title)}. Yours is still in your timetable.`;
  if (shared && mine && whenText(shared) !== whenText(mine)) {
    const sameDays = dayText(shared) === dayText(mine);
    return `${who} moved ${quoted(title)} to ${whenText(shared)}. Yours is still at ${sameDays ? startText(mine) : whenText(mine)}.`;
  }
  return `${who} changed ${quoted(title)}. Yours is still the way you set it.`;
}

// ---- The join checklist ------------------------------------------------------------------------------------

// The classes of a timetable as the checklist lists them: one row per title, so a subject's lecture and lab are
// one tick that covers both (the answer is still stored per class). `ticked` is whether the student takes it now.
export function classRows(entries) {
  const rows = new Map();
  for (const entry of entries.filter((item) => item.kind === "class")) {
    const key = entry.title.trim().toLowerCase();
    const row = rows.get(key) ?? { key, title: entry.title, ids: [], times: [], ticked: false };
    row.ids.push(entry._id);
    row.times.push(spanText(entry));
    row.ticked ||= entry.myChoice !== "hidden";
    rows.set(key, row);
  }
  return [...rows.values()].map(({ times, ...row }) => ({ ...row, times: times.join(" · ") }));
}
