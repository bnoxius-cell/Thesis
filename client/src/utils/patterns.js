import { toISODate, addDays, taskDueIso } from "./scheduleUtils";
import { differenceInDays } from "./workload";

// ---------------------------------------------------------------------------
// Behaviour patterns
//
// Looks back at how the student has been working and names a pattern worth a gentle word. Pure maths
// on its inputs (local time, `now` passed in). Nothing here feeds the workload score, band or tips.
// ---------------------------------------------------------------------------

const MAX_PATTERNS = 2;
const DAY_MS = 86400000;

const SLIPPING_DAYS = 14;
const SLIPPING_MIN_TASKS = 3;

// Medium and Large tasks are the ones over this many hours.
const BIG_TASK_HOURS = 1.5;
const LAST_MINUTE_DAYS = 28;
const LAST_MINUTE_MIN_TASKS = 4;
const LAST_MINUTE_SHARE = 0.6;

const CRAM_EXAM_DAYS = 3;
const CRAM_REVIEWER_DAYS = 3;
const CRAM_MIN_REVIEWERS = 3;

const LATE_NIGHT_DAYS = 14;
const LATE_NIGHT_MIN_NIGHTS = 3;
// Work between midnight and this hour counts as part of the evening before.
const LATE_NIGHT_END_HOUR = 4;

const localIso = (value) => toISODate(new Date(value));
const daysAgoIso = (now, days) => toISODate(addDays(now, -days));

const slipping = ({ tasks, now }) => {
  const today = toISODate(now);
  const from = daysAgoIso(now, SLIPPING_DAYS);
  const count = tasks.filter((task) => {
    const due = taskDueIso(task.dueDate);
    if (!due || due < from || due >= today) return false;
    if (!task.isCompleted) return true;
    return Boolean(task.completedAt) && localIso(task.completedAt) > due;
  }).length;
  if (count < SLIPPING_MIN_TASKS) return null;
  return {
    key: "slipping",
    title: "Deadlines have been slipping",
    text: `${count} tasks went past their date in the last 2 weeks. Starting the bigger ones a day earlier helps.`,
  };
};

const lastMinute = ({ tasks, now }) => {
  const from = daysAgoIso(now, LAST_MINUTE_DAYS);
  const recentBig = tasks.filter((task) => (
    task.isCompleted && task.completedAt && task.dueDate
    && Number(task.hours) > BIG_TASK_HOURS && localIso(task.completedAt) >= from
  ));
  const onTheDay = recentBig.filter((task) => localIso(task.completedAt) >= taskDueIso(task.dueDate)).length;
  if (recentBig.length < LAST_MINUTE_MIN_TASKS || onTheDay / recentBig.length < LAST_MINUTE_SHARE) return null;
  return {
    key: "last-minute",
    title: "Big tasks land on the due day",
    text: `${onTheDay} of your last ${recentBig.length} bigger tasks were finished on the day they were due. A day or two of room helps when something comes up.`,
  };
};

const cram = ({ reviewers, exams, now }) => {
  const exam = exams
    .filter((e) => differenceInDays(e.date, now) >= 0 && differenceInDays(e.date, now) <= CRAM_EXAM_DAYS)
    .sort((a, b) => differenceInDays(a.date, now) - differenceInDays(b.date, now))[0];
  if (!exam) return null;
  const since = now.getTime() - CRAM_REVIEWER_DAYS * DAY_MS;
  const made = reviewers.filter((r) => new Date(r.createdAt).getTime() >= since).length;
  if (made < CRAM_MIN_REVIEWERS) return null;
  return {
    key: "cram",
    title: `Lots of reviewers before ${exam.title}`,
    text: `You made ${made} reviewers in 3 days. Next time, starting a week out spreads it.`,
  };
};

const lateNight = ({ tasks, reviewers, now }) => {
  const since = now.getTime() - LATE_NIGHT_DAYS * DAY_MS;
  const times = [
    ...tasks.filter((task) => task.isCompleted).map((task) => task.completedAt),
    ...reviewers.map((r) => r.createdAt),
  ].filter(Boolean).map((value) => new Date(value));
  const nights = new Set(
    times
      .filter((at) => at.getTime() >= since && at.getHours() < LATE_NIGHT_END_HOUR)
      .map((at) => toISODate(addDays(at, -1))),
  );
  if (nights.size < LATE_NIGHT_MIN_NIGHTS) return null;
  return {
    key: "late-night",
    title: "Late nights are adding up",
    text: `You worked past midnight on ${nights.size} nights in the last 2 weeks. An earlier stop helps your sleep plan.`,
  };
};

// Up to two patterns, in priority order. Exam prep tasks are the schedule's, not the student's work.
export function noticePatterns({ tasks = [], reviewers = [], exams = [], now }) {
  const own = tasks.filter((task) => !task.isExam);
  const found = [
    slipping({ tasks: own, now }),
    lastMinute({ tasks: own, now }),
    cram({ reviewers, exams, now }),
    lateNight({ tasks: own, reviewers, now }),
  ];
  return found.filter(Boolean).slice(0, MAX_PATTERNS);
}
