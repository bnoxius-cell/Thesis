import { formatTime } from "@/utils/scheduleUtils";
import { profileFromUser } from "@/features/workload/useWorkload";

export const PACE_OPTIONS = [
  { value: "catch-up", label: "Relaxed" },
  { value: "steady", label: "Balanced" },
  { value: "high-performance", label: "Intense" },
];

const range = (from, to, step) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const hoursLabel = (n) => `${n} ${n === 1 ? "hour" : "hours"}`;

// The limits match the server's (userController.updateProfile): study 1-12 h, sleep 4-12 h, travel 0-240 min.
const STUDY = range(1, 12, 0.5).map((value) => ({ value, label: hoursLabel(value) }));
const SLEEP = range(4, 12, 0.5).map((value) => ({ value, label: hoursLabel(value) }));
const TRAVEL = range(0, 240, 5).map((value) => ({ value, label: value === 0 ? "None" : `${value} min` }));

const pad = (n) => String(n).padStart(2, "0");
const TIMES = range(0, 24 * 60 - 15, 15).map((minutes) => {
  const value = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  return { value, label: formatTime(value).toLowerCase() };
});

// A saved value that isn't on the list (an older account, a different step) still shows and stays
// selectable, instead of the picker looking empty.
// An empty value (a wake time not picked yet) adds nothing: the picker shows its placeholder.
const withCurrent = (options, value, label) =>
  value === undefined || value === "" || options.some((option) => option.value === value)
    ? options
    : [{ value, label: label(value) }, ...options];

// The picker lists for a form's current values: `rhythmForm` for the dialog, `sleepForm` for the Tonight card.
export function rhythmOptions(form) {
  return {
    study: withCurrent(STUDY, form.studyHoursPerDay, hoursLabel),
    sleep: withCurrent(SLEEP, form.sleepHours, hoursLabel),
    travel: withCurrent(TRAVEL, form.travelMinutesPerDay, (n) => `${n} min`),
    wakeTimes: withCurrent(TIMES, form.usualWakeTime, (v) => formatTime(v).toLowerCase()),
  };
}

// What the Your rhythm dialog starts from: study hours and pace, with the app's usual defaults.
export function rhythmForm(user) {
  const profile = profileFromUser(user);
  return { studyHoursPerDay: profile.studyHoursPerDay, wellbeingGoal: profile.wellbeingGoal };
}

// What the Tonight card starts from. The wake time is empty until the student picks one.
export function sleepForm(user) {
  const profile = profileFromUser(user);
  return {
    usualWakeTime: user?.usualWakeTime || "",
    sleepHours: profile.sleepHours,
    travelMinutesPerDay: profile.travelMinutesPerDay,
  };
}

export const rhythmChanged = (a, b) => Object.keys(a).some((key) => a[key] !== b[key]);

// The bedtime that gives `sleepHours` of sleep before `wakeTime` ("HH:MM"; past midnight wraps).
export function bedtimeFor(wakeTime, sleepHours) {
  const [h, m] = wakeTime.split(":").map(Number);
  const minutes = (((h * 60 + m - Math.round(sleepHours * 60)) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

// The worked-out bedtime as the card shows it ("10:15 pm"); empty until a wake time is picked.
export const bedtimeLabel = ({ usualWakeTime, sleepHours }) =>
  usualWakeTime ? formatTime(bedtimeFor(usualWakeTime, sleepHours)).toLowerCase() : "";

// The line under the bedtime: "6:15 am wake time minus 8 hours".
export const bedtimeSum = ({ usualWakeTime, sleepHours }) =>
  usualWakeTime ? `${formatTime(usualWakeTime).toLowerCase()} wake time minus ${hoursLabel(sleepHours)}` : "";

// The PUT /api/user/profile body for the Tonight card. A picked wake time means a regular schedule, and the
// bedtime is worked out from it. Without one only the target and travel go, so nothing else is made up.
// Fields left out are left alone by the server.
export function sleepPayload({ usualWakeTime, sleepHours, travelMinutesPerDay }) {
  const body = { sleepHours, travelMinutesPerDay };
  if (!usualWakeTime) return body;
  return { ...body, usualWakeTime, usualSleepStart: bedtimeFor(usualWakeTime, sleepHours), hasRegularSleepSchedule: true };
}
