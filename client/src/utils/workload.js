import { toISODate, addDays } from "./scheduleUtils";

// ---------------------------------------------------------------------------
// Workload model
//
// The score answers "how heavy is the coming week for this student?". It combines
// what has to be done (tasks), how much time is really left for it (the timetable),
// and how the student says they feel (PSS-10 and WHO-5). See CLAUDE.md for the
// full write-up of the weights.
// ---------------------------------------------------------------------------

// Waking hours in a day that can go to classes, activities and study. Roughly 16
// awake hours, minus meals, getting around and basic upkeep.
export const USABLE_HOURS = 14;
// Kept free every day for downtime, so a student is never "capable" of studying
// right up to bedtime.
export const REST_BUFFER = 2;
// Committed hours in a day that count as a completely full day for the schedule score.
const FULL_DAY_COMMITMENT = 8;
// Never plan further out than this many days when spreading a task.
const MAX_HORIZON = 60;
const WEEK = 7;

// Weights of each part of the score. Parts with no data (no surveys taken, no
// timetable, no tasks) drop out and the rest are rescaled, so a missing input
// never quietly counts as "average".
export const WEIGHTS = {
  time: 0.22, // scheduled study hours vs. hours free this week
  peak: 0.10, // the single most overloaded day
  schedule: 0.13, // how much of the week classes and activities already take
  stress: 0.18, // PSS-10
  wellbeing: 0.17, // WHO-5, inverted
  priority: 0.10, // share of task hours that are high importance
  difficulty: 0.10, // share of task hours that are difficult
};

export const BANDS = [
  { max: 30, name: "Light Workload" },
  { max: 60, name: "Moderate Workload" },
  { max: 80, name: "Heavy Workload" },
  { max: 100, name: "Critical Overload" },
];

export const bandFor = (score) => BANDS.find((b) => score <= b.max).name;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round1 = (n) => Math.round(n * 10) / 10;
const weekdayLong = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
};

export function differenceInDays(dateString, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// Per-task numbers used by the task cards (progress bar, status pill).
export function getTaskMetrics(task, now = new Date()) {
  const daysLeft = differenceInDays(task.dueDate, now);
  const urgencyBoost =
    daysLeft < 0 ? 10 : daysLeft === 0 ? 8 : daysLeft <= 2 ? 6 : daysLeft <= 5 ? 3 : 1;
  const workload = Number(task.hours) * 1.4 + Number(task.difficulty) * 2 + Number(task.importance) * 1.8 + urgencyBoost;
  let status = "On Track";
  if (daysLeft < 0) status = "Overdue";
  else if (daysLeft <= 1) status = "Critical";
  else if (daysLeft <= 3) status = "Upcoming";
  return { daysLeft, workload, status };
}

// "Study hours per day" is what the student can do on a typical day, which we take to
// have about this many hours of classes and activities in it.
const TYPICAL_COMMITMENT = 4;
// A day with nothing on can hold a bit more than a typical one, but not double.
const MAX_CAPACITY_FACTOR = 1.25;

// Hours a day can really hold for study. Scales the student's own figure by how much
// free time the day has compared with a typical one, and never exceeds what is left
// after classes, activities and the rest buffer.
export const studyCapacity = (studyHoursPerDay, busyHours) => {
  const free = USABLE_HOURS - busyHours - REST_BUFFER;
  const typicalFree = USABLE_HOURS - TYPICAL_COMMITMENT - REST_BUFFER;
  const factor = clamp(free / typicalFree, 0, MAX_CAPACITY_FACTOR);
  return round1(Math.max(0, Math.min(studyHoursPerDay * factor, free)));
};

// Lays the next seven days out: what the timetable already takes, how many study hours
// are left, and where each task's hours land. `overview` is the server's week
// overview (or null when there is no timetable).
export function buildWeek(tasks, profile, overview, now = new Date()) {
  const base = Math.max(Number(profile.studyHoursPerDay) || 0, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const byDate = new Map((overview?.days || []).map((d) => [d.date, d]));
  // Without a timetable we know nothing about the day, so trust the student's figure.
  const timetableKnown = Boolean(overview?.scheduleCount);

  const days = Array.from({ length: WEEK }, (_, i) => {
    const date = addDays(today, i);
    const key = toISODate(date);
    const o = byDate.get(key);
    const busyHours = o?.busyHours ?? 0;
    return {
      key,
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      dateLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      holiday: o?.holiday ?? null,
      entries: o?.entries ?? [],
      classHours: o?.classHours ?? 0,
      activityHours: o?.activityHours ?? 0,
      busyHours,
      capacity: timetableKnown ? studyCapacity(base, busyHours) : base,
      load: 0,
      items: [],
    };
  });

  // Earliest deadline first, so tight tasks claim room before relaxed ones do.
  const ordered = tasks
    .map((task) => ({ task, ...getTaskMetrics(task, now) }))
    .sort((a, b) => a.daysLeft - b.daysLeft || b.workload - a.workload);

  ordered.forEach(({ task, daysLeft }) => {
    const hours = Number(task.hours) || 0;
    if (hours <= 0) return;
    // Overdue work lands today. Otherwise it is spread over every day up to the due
    // date, leaning toward the days with the most room left.
    const last = clamp(daysLeft, 0, MAX_HORIZON - 1);
    const room = (i) => (i < WEEK ? Math.max(days[i].capacity - days[i].load, 0.25) : base);
    let totalRoom = 0;
    for (let i = 0; i <= last; i += 1) totalRoom += room(i);

    const shares = [];
    for (let i = 0; i <= Math.min(last, WEEK - 1); i += 1) shares.push([i, (hours * room(i)) / totalRoom]);
    shares.forEach(([i, share]) => {
      if (share < 0.05) return;
      days[i].load += share;
      days[i].items.push({ title: task.title, course: task.course, hours: round1(share) });
    });
  });

  return days.map((d) => ({ ...d, load: round1(d.load) }));
}

const level = (value) => (value < 34 ? "low" : value < 67 ? "moderate" : "high");

// Turns the week and the survey scores into a 0-100 score, a band, the parts that
// drove it, and a short list of tips.
export function computeWorkload({ tasks, profile, days, pssScore, whoScore, isExamWeek = false, hasSchedule = false }) {
  const hasTasks = tasks.length > 0;
  const hasPss = pssScore !== null && pssScore !== undefined;
  const hasWho = whoScore !== null && whoScore !== undefined;

  if (!hasTasks && !hasSchedule && !hasPss && !hasWho) {
    return {
      isNewUser: true,
      workloadScore: 0,
      band: "Light Workload",
      parts: [],
      tips: [],
      totals: { studyHours: 0, capacityHours: 0, busyHours: 0, overdue: 0 },
    };
  }

  const studyHours = days.reduce((sum, d) => sum + d.load, 0);
  const capacityHours = days.reduce((sum, d) => sum + d.capacity, 0);
  const busyHours = days.reduce((sum, d) => sum + d.busyHours, 0);
  const overdue = tasks.filter((t) => getTaskMetrics(t).daysLeft < 0).length;

  // Share of the hours that matter (not the number of tasks), so one big important
  // assignment weighs more than three tiny ones.
  const hourWeight = (t) => Math.max(Number(t.hours) || 0, 0.5);
  const totalWeight = tasks.reduce((s, t) => s + hourWeight(t), 0);
  const shareOf = (test) => (totalWeight ? (tasks.filter(test).reduce((s, t) => s + hourWeight(t), 0) / totalWeight) * 100 : 0);

  const values = {
    time: capacityHours > 0 ? clamp((studyHours / capacityHours) * 100, 0, 100) : studyHours > 0 ? 100 : 0,
    peak: clamp(
      Math.max(0, ...days.map((d) => (d.capacity > 0 ? d.load / d.capacity : d.load > 0 ? 1 : 0))) * 100,
      0,
      100
    ),
    schedule: hasSchedule ? clamp((busyHours / (WEEK * FULL_DAY_COMMITMENT)) * 100, 0, 100) : null,
    stress: hasPss ? clamp((pssScore / 40) * 100, 0, 100) : null,
    wellbeing: hasWho ? clamp(100 - whoScore, 0, 100) : null,
    priority: hasTasks ? shareOf((t) => (t.importance || 3) >= 4) : null,
    difficulty: hasTasks ? shareOf((t) => (t.difficulty || 3) >= 4) : null,
  };

  let weighted = 0;
  let weightSum = 0;
  Object.entries(WEIGHTS).forEach(([key, w]) => {
    if (values[key] === null) return;
    weighted += w * values[key];
    weightSum += w;
  });
  const base = weightSum ? weighted / weightSum : 0;

  // Adjustments that shift the score directly, in points.
  const goal = profile.wellbeingGoal === "catch-up" ? -10 : profile.wellbeingGoal === "high-performance" ? 10 : 0;
  const exam = isExamWeek ? 15 : 0;
  const overduePoints = Math.min(10, overdue * 3);

  const workloadScore = Math.round(clamp(base + goal + exam + overduePoints, 0, 100));
  const band = bandFor(workloadScore);

  const partLabels = [
    ["time", "Deadlines"],
    ["schedule", "Classes and activities"],
    ["stress", "Stress check-in"],
    ["wellbeing", "Well-being check-in"],
  ];
  const parts = partLabels
    .filter(([key]) => values[key] !== null)
    .map(([key, label]) => ({ key, label, value: Math.round(values[key]), level: level(values[key]) }));

  const tips = buildTips({
    tasks, profile, days, values, overdue, workloadScore, hasSchedule, hasPss, hasWho, isExamWeek, goal, studyHours, capacityHours,
  });

  return {
    isNewUser: false,
    workloadScore,
    band,
    parts,
    tips,
    values,
    adjustments: { goal, exam, overdue: overduePoints },
    totals: { studyHours: round1(studyHours), capacityHours: round1(capacityHours), busyHours: round1(busyHours), overdue },
  };
}

const TONE_ORDER = { alert: 0, watch: 1, info: 2, good: 3 };

function buildTips({ tasks, days, values, overdue, workloadScore, hasSchedule, hasPss, hasWho, isExamWeek, goal, studyHours, capacityHours }) {
  const tips = [];
  const add = (tone, title, text) => tips.push({ tone, title, text });

  if (overdue > 0) {
    add("alert", `${overdue} overdue ${overdue === 1 ? "task" : "tasks"}`,
      "Start with the smallest one. A quick win gets things moving, and if a deadline can be moved, it's fine to ask.");
  }

  // The most overloaded day, and a lighter earlier day to borrow from.
  const over = days
    .map((d, i) => ({ d, i, ratio: d.capacity > 0 ? d.load / d.capacity : d.load > 0 ? 2 : 0 }))
    .filter(({ ratio }) => ratio > 1.05)
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (over) {
    const { d, i } = over;
    const lighter = days.slice(0, i).map((x, j) => ({ x, j, room: x.capacity - x.load })).filter(({ room }) => room >= 1).sort((a, b) => b.room - a.room)[0];
    const detail = d.busyHours > 0
      ? `${round1(d.busyHours)}h of classes and activities leave room for about ${d.capacity}h of study, but ${d.load}h of tasks land there.`
      : `About ${d.load}h of tasks land there, and you have room for ${d.capacity}h.`;
    add("alert", `${weekdayLong(d.key)} is packed`,
      `${detail}${lighter ? ` ${weekdayLong(lighter.x.key)} is lighter, so starting then would help.` : " Try moving something or asking for more time."}`);
  } else if (capacityHours > 0 && studyHours / capacityHours > 0.7) {
    add("watch", "Your week is nearly full", "Protect your study blocks and try not to take on anything extra until the next deadline passes.");
  }

  const holidays = days.filter((d) => d.holiday);
  if (holidays.length) {
    const first = holidays[0];
    add("info", `${weekdayLong(first.key)} is a day off`,
      `${first.holiday}. Classes marked to skip are left out of this week's numbers. Use the time to catch up or to recharge.`);
  }

  // A good day to get ahead, or to rest.
  const easiest = days
    .map((d, i) => ({ d, i, room: d.capacity - d.load }))
    .filter(({ d, i, room }) => i > 0 && d.load < 0.5 && room >= 2 && d.key !== over?.d.key)
    .sort((a, b) => b.room - a.room)[0];
  if (easiest && tasks.length) {
    add("good", `${weekdayLong(easiest.d.key)} looks light`,
      `${easiest.d.busyHours > 0 ? `Only ${round1(easiest.d.busyHours)}h is booked.` : "Nothing is booked."} Good for getting ahead on something, or keeping it free to rest.`);
  }

  if (values.stress !== null && values.stress > 60) {
    add("watch", "Stress is running high", "Take short breaks between study blocks. If it stays high, the guidance office is there for exactly this.");
  } else if (values.stress !== null && values.stress > 30) {
    add("info", "Some stress showing", "Short breaks and tackling one thing at a time tend to help.");
  }
  if (values.wellbeing !== null && values.wellbeing > 70) {
    add("alert", "Your well-being is low", "Rest comes first this week. Talking to a counsellor or someone you trust can make it lighter.");
  } else if (values.wellbeing !== null && values.wellbeing > 50) {
    add("watch", "Your well-being is a bit low", "Lighten what you can, and put something restful on the calendar.");
  }

  if (values.difficulty !== null && values.difficulty > 50) {
    add("info", "A lot of hard tasks", "Split the difficult ones into smaller steps, and ask a classmate or teacher early instead of late.");
  }
  if (values.priority !== null && values.priority > 60) {
    add("info", "Most of your hours are high priority", "Start with the most urgent one, and let the rest wait their turn.");
  }
  if (isExamWeek) {
    add("watch", "Exam week", "Pause the non-essentials and put your energy into revision and sleep.");
  }
  if (goal < 0) add("info", "Recovery mode", "Your goal is catching up, so the score is a little gentler and the tips favour rest.");
  if (goal > 0) add("info", "High-performance mode", "Your goal is high performance, so the score allows a heavier load before it warns you.");

  if (!hasSchedule) {
    add("info", "Add your class schedule", "Your workload can only count classes once your timetable is in. It takes a couple of minutes.");
  }
  if (!hasPss && !hasWho) {
    add("info", "Take a check-in", "The score is based on your tasks and schedule for now. A check-in makes it more personal.");
  }

  if (!tips.some((t) => t.tone === "alert" || t.tone === "watch")) {
    add("good", workloadScore <= 30 ? "A light week" : "You're on track",
      workloadScore <= 30 ? "There's room to get ahead, or just to rest. Both count." : "Keep the pace steady and check back as new deadlines arrive.");
  }

  return tips.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, 5);
}
