import { useMemo } from "react";
import { fromISODate } from "@/utils/scheduleUtils";
import {
  buildWeek, computeWorkload, getTaskMetrics, surveyStatus, examsToTasks, examPressure,
  PSS_VALID_DAYS, WHO_VALID_DAYS,
} from "@/utils/workload";
import { buildFocus } from "@/utils/todayFocus";
import { toWeekReading } from "@/utils/weekReading";

const DEFAULT_PROFILE = {
  studyHoursPerDay: 4,
  sleepHours: 8,
  travelMinutesPerDay: 0,
};

// What the week maths reads from the account, with the same defaults the old pages used.
function profileFromUser(u) {
  if (!u) return DEFAULT_PROFILE;
  return {
    studyHoursPerDay: u.studyHoursPerDay || 4,
    sleepHours: u.sleepHours ?? 8,
    travelMinutesPerDay: u.travelMinutesPerDay ?? 0,
  };
}

// The day the week looks heaviest, or null when nothing is on it. Ties go to the earlier day.
function heaviestDay(week) {
  const total = (d) => d.busyHours + d.load;
  const top = week.reduce((best, d) => (total(d) > total(best) ? d : best), week[0]);
  if (!top || total(top) <= 0) return null;
  const name = top.key === week[0].key ? "Today" : fromISODate(top.key).toLocaleDateString("en-US", { weekday: "long" });
  return { key: top.key, name };
}

// Turns the loaded tasks, timetable and account into what the pages show. Pure maths on its inputs:
// no fetching and no state, so any screen can call it with the same data. A check-in older than its
// window no longer describes the student, so it stays out of the score (surveyStatus).
export default function useWorkload({ tasks, overview, userData, now }) {
  return useMemo(() => {
    const profile = profileFromUser(userData);
    const activeTasks = tasks.filter((task) => !task.isCompleted);
    const enrichedTasks = activeTasks
      .map((task) => ({ ...task, ...getTaskMetrics(task, now) }))
      .sort((a, b) => b.workload - a.workload);
    const hasSchedule = Boolean(overview?.scheduleCount && overview?.entryCount);
    // Exams in the timetable become study work due on the exam date, so the week plans around them.
    const exams = overview?.upcomingExams || [];
    const plannedTasks = [...activeTasks, ...examsToTasks(exams)];
    const week = buildWeek(plannedTasks, profile, overview, now);
    const pss = surveyStatus(userData?.latestPSSScore ?? null, userData?.lastPSSSubmission || null, PSS_VALID_DAYS, now);
    const who = surveyStatus(userData?.latestWHOScore ?? null, userData?.lastWHOSubmission || null, WHO_VALID_DAYS, now);
    const insights = computeWorkload({
      tasks: plannedTasks, profile, days: week, pssScore: pss.score, whoScore: who.score, hasSchedule,
      pssStatus: pss.status, whoStatus: who.status, pssAgeDays: pss.ageDays, whoAgeDays: who.ageDays, now, exams,
    });
    return {
      enrichedTasks,
      hasSchedule,
      week,
      insights,
      nextExam: examPressure(exams, now).next,
      today: week[0],
      focus: buildFocus({ today: week[0], tomorrow: week[1], tasks: enrichedTasks, now }),
      reading: toWeekReading({ insights, plannedTasks, now }),
      heaviest: heaviestDay(week),
    };
  }, [tasks, overview, userData, now]);
}
