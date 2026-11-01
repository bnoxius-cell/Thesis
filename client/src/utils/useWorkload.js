import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../pages/authentication/AuthContext";
import { toISODate } from "./scheduleUtils";
import { buildWeek, computeWorkload, getTaskMetrics, surveyStatus, examsToTasks, examPressure, PSS_VALID_DAYS, WHO_VALID_DAYS } from "./workload";
import { isStrained } from "./suggestions";
import { buildFocus } from "./todayFocus";

// New accounts get a quiet first day: no check-in nudge until this much time has passed since
// registration. Accounts from before this feature have no createdAt and get the old
// immediate-reminder behavior instead of a permanent grace period.
const ONBOARDING_GRACE_MS = 24 * 60 * 60 * 1000;
const isWithinGracePeriod = (createdAt, nowMs) => Boolean(createdAt) && nowMs - new Date(createdAt).getTime() < ONBOARDING_GRACE_MS;

const reminderKey = (type, userId) => `remind${type}Until:${userId || "anonymous"}`;
const readReminder = (type, userId) => {
  try {
    const until = localStorage.getItem(reminderKey(type, userId));
    return until ? parseInt(until, 10) : 0;
  } catch {
    return 0;
  }
};

// "Later" is counted per due cycle. A cycle is named by the day the check-in became due, so taking the
// check-in (which moves that day) starts a fresh count. Storage can throw, so every access is wrapped.
export const LATER_LIMIT = 3;
const laterKey = (type, userId) => `stresscare:checkin-later:${userId || "anonymous"}:${type}`;
const isoDay = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// The day a check-in became due: last submission + valid days, or account creation + the grace for never-taken.
export function dueSinceFor(last, validDays, createdAt) {
  if (last) {
    const d = new Date(last);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + validDays);
    return isoDay(d);
  }
  return createdAt ? isoDay(new Date(createdAt).getTime() + ONBOARDING_GRACE_MS) : "";
}
export function readLaterCount(type, userId, since) {
  try {
    const saved = JSON.parse(localStorage.getItem(laterKey(type, userId)) || "null");
    return saved && saved.since === since ? Number(saved.count) || 0 : 0;
  } catch {
    return 0;
  }
}
function bumpLater(type, userId, since) {
  try {
    localStorage.setItem(laterKey(type, userId), JSON.stringify({ since, count: readLaterCount(type, userId, since) + 1 }));
  } catch { /* private mode */ }
}

const DEFAULT_PROFILE = {
  studentName: "",
  program: "BS Information Technology",
  studyHoursPerDay: 4,
  sleepHours: 8,
  hasRegularSleepSchedule: true,
  usualSleepStart: "23:00",
  usualWakeTime: "07:00",
  travelMinutesPerDay: 0,
  wellbeingGoal: "steady",
};

export function profileFromUser(u) {
  if (!u) return DEFAULT_PROFILE;
  return {
    studentName: u.name || "",
    program: u.program || DEFAULT_PROFILE.program,
    studyHoursPerDay: u.studyHoursPerDay || 4,
    sleepHours: u.sleepHours ?? 8,
    hasRegularSleepSchedule: u.hasRegularSleepSchedule !== false,
    usualSleepStart: u.usualSleepStart || "23:00",
    usualWakeTime: u.usualWakeTime || "07:00",
    travelMinutesPerDay: u.travelMinutesPerDay ?? 0,
    wellbeingGoal: u.wellbeingGoal || "steady",
  };
}

// Every screen that talks about "the week" (Today, Wellbeing, Schedule > Tasks) reads the same
// data and does the same maths, so it lives here once. The profile comes from AuthContext's
// userData instead of a second /api/user/data request; call `refreshUser()` after a check-in or a
// profile save.
export default function useWorkload() {
  const { backendUrl, isLoggedin, userData, getUserData } = useAuth();
  const [tasks, setTasks] = useState([]);
  // The next seven days of the user's timetable. Stays null if the request fails, which the
  // workload treats the same as having no timetable.
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  // Ticks each minute so the Today panel moves on as classes start and finish.
  const [now, setNow] = useState(() => new Date());
  // Bumped when a check-in is snoozed so the due flags are worked out again.
  const [snoozeTick, setSnoozeTick] = useState(0);

  const refreshTasks = useCallback(async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/tasks`, { withCredentials: true });
      if (data.success) setTasks(data.tasks);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    }
  }, [backendUrl]);

  const refreshOverview = useCallback(async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/schedules/week`, {
        params: { start: toISODate(new Date()) },
        withCredentials: true,
      });
      if (data.success) setOverview(data);
    } catch (err) {
      console.error("Failed to fetch schedule overview", err);
    }
  }, [backendUrl]);

  const refreshUser = useCallback(() => getUserData?.(), [getUserData]);

  useEffect(() => {
    if (!isLoggedin) return;
    Promise.all([refreshTasks(), refreshOverview()]).finally(() => setLoading(false));
  }, [isLoggedin, refreshTasks, refreshOverview]);

  // Coming back from another tab should show the new timetable.
  useEffect(() => {
    if (!isLoggedin) return undefined;
    const refresh = () => { if (!document.hidden) refreshOverview(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [isLoggedin, refreshOverview]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const profile = useMemo(() => profileFromUser(userData), [userData]);
  const userId = userData?._id || "";

  // "Not today" snoozes until tomorrow rather than a 30-minute countdown that would bring the
  // check-in back the same afternoon.
  const snooze = useCallback((...types) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    types.forEach((type) => {
      bumpLater(type, userId, type === "PSS" ? dueSinceFor(userData?.lastPSSSubmission, PSS_VALID_DAYS, userData?.createdAt) : dueSinceFor(userData?.lastWHOSubmission, WHO_VALID_DAYS, userData?.createdAt));
      try { localStorage.setItem(reminderKey(type, userId), tomorrow.getTime()); } catch { /* private mode */ }
    });
    setSnoozeTick((n) => n + 1);
  }, [userId, userData]);

  const due = useMemo(() => {
    const result = { pssDue: false, whoDue: false };
    if (!userData) return result;
    const nowMs = now.getTime();
    const startOfToday = new Date(nowMs);
    startOfToday.setHours(0, 0, 0, 0);
    const inGrace = isWithinGracePeriod(userData.createdAt, nowMs);
    const check = (type, last, validDays) => {
      if (nowMs < readReminder(type, userData._id)) return false;
      if (!last) return !inGrace;
      const lastDay = new Date(last);
      lastDay.setHours(0, 0, 0, 0);
      return (startOfToday - lastDay) / 86400000 >= validDays;
    };
    result.pssDue = check("PSS", userData.lastPSSSubmission, PSS_VALID_DAYS);
    result.whoDue = check("WHO", userData.lastWHOSubmission, WHO_VALID_DAYS);
    return result;
    // snoozeTick re-runs this after a snooze, since localStorage isn't reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, snoozeTick, now]);

  const pssDueSince = dueSinceFor(userData?.lastPSSSubmission, PSS_VALID_DAYS, userData?.createdAt);
  const whoDueSince = dueSinceFor(userData?.lastWHOSubmission, WHO_VALID_DAYS, userData?.createdAt);
  // Read on every render (cheap); snoozeTick re-renders after a Later.
  const laterCount = (type) => readLaterCount(type, userId, type === "PSS" ? pssDueSince : whoDueSince);

  const derived = useMemo(() => {
    const activeTasks = tasks.filter((task) => !task.isCompleted);
    const enrichedTasks = activeTasks.map((task) => ({ ...task, ...getTaskMetrics(task, now) })).sort((a, b) => b.workload - a.workload);
    const hasSchedule = Boolean(overview?.scheduleCount && overview?.entryCount);
    // Exams in the schedule turn into study work due on the exam date, so the week, the score and
    // the guidance all plan around them. They stay out of the task list.
    const exams = overview?.upcomingExams || [];
    const examTasks = examsToTasks(exams);
    const plannedTasks = [...activeTasks, ...examTasks];
    const week = buildWeek(plannedTasks, profile, overview, now);
    // A check-in older than its window no longer describes the student, so it stays out of the score.
    const pss = surveyStatus(userData?.latestPSSScore ?? null, userData?.lastPSSSubmission || null, PSS_VALID_DAYS, now);
    const who = surveyStatus(userData?.latestWHOScore ?? null, userData?.lastWHOSubmission || null, WHO_VALID_DAYS, now);
    const insights = computeWorkload({
      tasks: plannedTasks, profile, days: week, pssScore: pss.score, whoScore: who.score, hasSchedule,
      pssStatus: pss.status, whoStatus: who.status, pssAgeDays: pss.ageDays, whoAgeDays: who.ageDays, now, exams,
    });
    const nextExam = examPressure(exams, now).next;
    const strained = isStrained({ band: insights.band, pssScore: pss.score, whoScore: who.score });
    const today = week[0];
    const focus = buildFocus({ today, tomorrow: week[1], tasks: enrichedTasks, now });
    return {
      activeTasks, enrichedTasks, hasSchedule, exams, examTasks, plannedTasks, week, pss, who,
      insights, nextExam, strained, today, focus, hasFreshCheckIn: pss.score !== null || who.score !== null,
    };
  }, [tasks, overview, profile, userData, now]);

  // Task actions. A failed save says so instead of silently doing nothing (system-review B11).
  const updateTask = useCallback(async (taskId, fields) => {
    try {
      const { data } = await axios.put(`${backendUrl}/api/tasks/${taskId}`, fields, { withCredentials: true });
      if (data.success) {
        setTasks((prev) => prev.map((t) => (t._id === taskId ? data.task : t)));
        return true;
      }
      toast.error(data.message || "That change didn't save. Try again.");
    } catch (err) {
      console.error("Update failed", err);
      toast.error(err.response?.data?.message || "That change didn't save. Try again.");
    }
    return false;
  }, [backendUrl]);

  const deleteTask = useCallback(async (taskId) => {
    try {
      const { data } = await axios.delete(`${backendUrl}/api/tasks/${taskId}`, { withCredentials: true });
      if (data.success) {
        setTasks((prev) => prev.filter((t) => t._id !== taskId));
        return true;
      }
      toast.error(data.message || "That task wasn't deleted. Try again.");
    } catch (err) {
      console.error("Delete error", err);
      toast.error(err.response?.data?.message || "That task wasn't deleted. Try again.");
    }
    return false;
  }, [backendUrl]);

  const markTaskDone = useCallback((taskId) => updateTask(taskId, { isCompleted: true }), [updateTask]);

  return {
    loading: loading && isLoggedin, isLoggedin, userData, userId, profile, tasks, setTasks, overview, now,
    pssDue: due.pssDue, whoDue: due.whoDue, pssDueSince, whoDueSince, laterCount,
    pssNeverTaken: !userData?.lastPSSSubmission, whoNeverTaken: !userData?.lastWHOSubmission,
    snooze, refreshUser, refreshTasks, refreshOverview, updateTask, deleteTask, markTaskDone,
    ...derived,
  };
}
