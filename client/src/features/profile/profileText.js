import { PACE_OPTIONS } from "@/features/wellbeing/rhythm";
import { profileFromUser } from "@/features/workload/useWorkload";

const DEFAULT_WAKE = "07:00";

// "March 2026", or "" when the account has no creation date.
export const memberSince = (createdAt) => {
  const date = createdAt ? new Date(createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const hoursText = (n) => {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded} ${rounded === 1 ? "hour" : "hours"}`;
};

// "23:00" -> "11 pm", "06:30" -> "6:30 am".
const clock = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const minutes = m ? `:${String(m).padStart(2, "0")}` : "";
  return `${h % 12 || 12}${minutes} ${h >= 12 ? "pm" : "am"}`;
};

// The three rows of the Your rhythm card, from the account (the same defaults the rest of the app uses).
// A student without a regular bedtime has no times to show, so the sleep goal is their hours.
export function rhythmRows(user) {
  const profile = profileFromUser(user);
  const pace = PACE_OPTIONS.find((option) => option.value === profile.wellbeingGoal) ?? PACE_OPTIONS[1];
  const sleep = profile.hasRegularSleepSchedule
    ? `${clock(profile.usualSleepStart)} to ${clock(user?.usualWakeTime || DEFAULT_WAKE)}`
    : hoursText(profile.sleepHours);
  return [
    { label: "Study hours a day", value: hoursText(profile.studyHoursPerDay) },
    { label: "Sleep goal", value: sleep },
    { label: "Pace", value: pace.label },
  ];
}
