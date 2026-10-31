import { formatTime } from "@/utils/scheduleUtils";
import { profileFromUser } from "@/features/workload/useWorkload";

const DEFAULT_WAKE = "07:00";

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
const withCurrent = (options, value, label) =>
  options.some((option) => option.value === value) ? options : [{ value, label: label(value) }, ...options];

// The picker lists for a form's current values.
export function rhythmOptions(form) {
  return {
    study: withCurrent(STUDY, form.studyHoursPerDay, hoursLabel),
    sleep: withCurrent(SLEEP, form.sleepHours, hoursLabel),
    travel: withCurrent(TRAVEL, form.travelMinutesPerDay, (n) => `${n} min`),
    times: withCurrent(TIMES, form.usualSleepStart, (v) => formatTime(v).toLowerCase()),
    wakeTimes: withCurrent(TIMES, form.usualWakeTime, (v) => formatTime(v).toLowerCase()),
  };
}

// What the dialog starts from: the account's rhythm, with the same defaults the rest of the app uses.
export function rhythmForm(user) {
  const profile = profileFromUser(user);
  return {
    studyHoursPerDay: profile.studyHoursPerDay,
    sleepHours: profile.sleepHours,
    usualSleepStart: profile.usualSleepStart,
    usualWakeTime: user?.usualWakeTime || DEFAULT_WAKE,
    travelMinutesPerDay: profile.travelMinutesPerDay,
    wellbeingGoal: profile.wellbeingGoal,
  };
}

export const rhythmChanged = (a, b) => Object.keys(a).some((key) => a[key] !== b[key]);

// The PUT /api/user/profile body. Picking a bedtime and wake time means a regular schedule, which is
// what the sleep plan needs to work from.
export const rhythmPayload = (form) => ({ ...form, hasRegularSleepSchedule: true });
