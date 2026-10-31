import { formatTime } from "@/utils/scheduleUtils";
import { tomorrowSleepPlan } from "@/utils/sleepPlan";

const DEFAULT_WAKE = "07:00";

// What the Sleep card says tonight. `plan` (from sleepPlan.js) wins when tomorrow starts early enough to
// need an earlier bedtime; otherwise the student's usual bedtime and wake time stand. Without a regular
// schedule there is no window to draw, only the target.
//   headline  the big line
//   window    { bed, wake } clock texts, or null
//   target    hours of sleep they aim for
//   note      a short line under the headline
export function sleepSummary({ week, profile, usualWakeTime }) {
  const target = profile.sleepHours;
  const plan = tomorrowSleepPlan({ week, profile });
  if (plan) return { headline: `Bed by ${plan.bedtime}`, window: { bed: plan.bedtime, wake: plan.wakeUp }, target, note: plan.text };

  if (!profile.hasRegularSleepSchedule) {
    return { headline: `Aim for ${target} hours of sleep`, window: null, target, note: "" };
  }
  const bed = formatTime(profile.usualSleepStart);
  return {
    headline: `Bed by ${bed}`,
    window: { bed, wake: formatTime(usualWakeTime || DEFAULT_WAKE) },
    target,
    note: "Nothing early tomorrow, so your usual bedtime works.",
  };
}
