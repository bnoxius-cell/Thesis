import { formatTime } from "@/utils/scheduleUtils";

export const lower = (hhmm) => formatTime(hhmm).replace(" AM", " am").replace(" PM", " pm");

// "8:00 – 10:00 am" when both ends share am or pm (so a narrow column keeps it on one line),
// "11:00 am – 1:00 pm" when they don't.
export function timeRange(startTime, endTime) {
  const from = lower(startTime);
  const to = lower(endTime);
  return from.slice(-2) === to.slice(-2) ? `${from.slice(0, -3)} – ${to}` : `${from} – ${to}`;
}

// "8:00 to 9:30 am" when both ends share am or pm, "11:00 am to 1:00 pm" when they don't (a class time row).
export function timeRangeText(startTime, endTime) {
  const from = lower(startTime);
  const to = lower(endTime);
  return from.slice(-2) === to.slice(-2) ? `${from.slice(0, -3)} to ${to}` : `${from} to ${to}`;
}
