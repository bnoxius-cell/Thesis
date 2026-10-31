import { clampHours, studyCapacity } from "@/utils/workload";

// How heavy one day looks: "heavy" when the work due that day is more than the day can hold after
// its classes (the same capacity the workload score uses), or when classes leave no room at all.
// Everything else is "light". `profile` is the shape profileFromUser gives (useWorkload.js).
export function dayLoad({ busyHours, tasks, profile }) {
  const base = Math.max(Number(profile.studyHoursPerDay) || 0, 1);
  const travelHours = Math.min(Math.max(Number(profile.travelMinutesPerDay) || 0, 0), 240) / 60;
  const capacity = studyCapacity(base, busyHours, profile.sleepHours, travelHours);
  const dueHours = tasks.reduce((sum, task) => sum + clampHours(task.hours), 0);
  return capacity === 0 || dueHours > capacity ? "heavy" : "light";
}
