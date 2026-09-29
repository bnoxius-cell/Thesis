import { toISODate, addDays, formatTime } from "./scheduleUtils";

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

// How long a check-in stays meaningful. Past this, the old score describes someone the
// student may no longer be, so it is left out of the workload until they retake it.
// These match the "due again" timing on the dashboard.
export const PSS_VALID_DAYS = 30;
export const WHO_VALID_DAYS = 14;

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

// Whether a check-in still counts. `score` comes back as null when it is missing or too old,
// which is what the workload treats as "no data" (and rescales around).
export function surveyStatus(score, lastSubmission, validDays, now = new Date()) {
  if (score === null || score === undefined || !lastSubmission) {
    return { status: "never", score: null, ageDays: null };
  }
  const ageDays = Math.max(0, -differenceInDays(lastSubmission, now));
  return ageDays < validDays
    ? { status: "fresh", score, ageDays }
    : { status: "stale", score: null, ageDays };
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
//
// `pssScore` / `whoScore` must already be null when the check-in is missing or out of date
// (see surveyStatus), so an old result never shapes the score. `pssStatus` / `whoStatus`
// ("fresh" | "stale" | "never") and the ages only feed the tips.
export function computeWorkload({
  tasks, profile, days, pssScore, whoScore, isExamWeek = false, hasSchedule = false,
  pssStatus, whoStatus, pssAgeDays = null, whoAgeDays = null, now = new Date(),
}) {
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
  const overdue = tasks.filter((t) => getTaskMetrics(t, now).daysLeft < 0).length;

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
    tasks, profile, days, values, overdue, workloadScore, hasSchedule, isExamWeek, goal, studyHours, capacityHours, now,
    pssScore: hasPss ? pssScore : null,
    whoScore: hasWho ? whoScore : null,
    pssStatus: pssStatus || (hasPss ? "fresh" : "never"),
    whoStatus: whoStatus || (hasWho ? "fresh" : "never"),
    pssAgeDays,
    whoAgeDays,
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

// ---------------------------------------------------------------------------
// Guidance
//
// Tips are picked from what the student actually has: tasks, a timetable, and check-ins that
// are still fresh. With no tasks the advice is about the timetable and rest, with no timetable
// it leans on deadlines, and a missing or out-of-date check-in is called out on its own instead
// of being guessed at. At most five are shown, most urgent first.
// ---------------------------------------------------------------------------

const TONE_ORDER = { alert: 0, watch: 1, info: 2, good: 3 };
const MAX_TIPS = 5;
// A gap between classes has to be at least this long to suggest using it.
const USEFUL_GAP_MINUTES = 90;
// A class starting before this is an early start worth planning sleep around.
const EARLY_START_MINUTES = 8 * 60;
// Classes plus activities in one day past this many hours make it a long day.
const LONG_DAY_HOURS = 6;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const durationText = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const dayName = (day, i) => (i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekdayLong(day.key));
const dueText = (daysLeft) => (daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`);

// The first stretch of at least USEFUL_GAP_MINUTES between two entries in the next few days.
// Today's gaps only count for the part that is still ahead of `now`.
function findGap(days, now) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < Math.min(days.length, 3); i += 1) {
    const entries = [...days[i].entries].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    for (let j = 0; j < entries.length - 1; j += 1) {
      const from = Math.max(toMinutes(entries[j].endTime), i === 0 ? nowMinutes : 0);
      const to = toMinutes(entries[j + 1].startTime);
      if (to - from >= USEFUL_GAP_MINUTES) return { dayIndex: i, from, to, before: entries[j], after: entries[j + 1] };
    }
  }
  return null;
}

function buildTips({
  tasks, days, values, overdue, workloadScore, hasSchedule, isExamWeek, goal, studyHours, capacityHours, now,
  pssScore, whoScore, pssStatus, whoStatus, pssAgeDays, whoAgeDays,
}) {
  const tips = [];
  const add = (tone, title, text) => tips.push({ tone, title, text });

  const hasTasks = tasks.length > 0;
  const fullness = capacityHours > 0 ? studyHours / capacityHours : studyHours > 0 ? 1.5 : 0;
  const heavyWeek = hasTasks && (fullness > 0.7 || values.peak > 85 || overdue > 0);
  // Thresholds are the instruments' own: PSS-10 27+ is high and 14-26 moderate, WHO-5 28 or
  // below is very low and under 50 is low.
  const stress = pssScore === null ? null : pssScore >= 27 ? "high" : pssScore >= 14 ? "moderate" : "low";
  const mood = whoScore === null ? null : whoScore <= 28 ? "very-low" : whoScore < 50 ? "low" : whoScore <= 75 ? "moderate" : "good";
  const struggling = stress === "high" || mood === "very-low" || mood === "low";

  const upcoming = tasks
    .map((task) => ({ task, ...getTaskMetrics(task, now) }))
    .filter((x) => x.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft || b.workload - a.workload)[0];

  // ---- Deadlines ----
  if (overdue > 0) {
    add("alert", plural(overdue, "overdue task"),
      struggling
        ? "Pick the smallest one and give it 25 minutes. Getting one thing off the list helps more than worrying about all of them, and it's fine to ask for more time."
        : "Start with the smallest one. A quick win gets things moving, and if a deadline can be moved, it's fine to ask.");
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
  } else if (hasTasks && fullness > 0.7) {
    add("watch", "Your week is nearly full", "Protect your study blocks and try not to take on anything extra until the next deadline passes.");
  }

  // ---- How the student says they feel (only check-ins that still count) ----
  if (mood === "very-low") {
    add("alert", "Your well-being is very low",
      heavyWeek
        ? "Rest comes before the workload this week. Talk to a counsellor or someone you trust, and tell a teacher early if a deadline feels out of reach."
        : "Your check-in shows you're struggling, even though the workload is manageable. A counsellor or someone you trust is worth reaching out to.");
  } else if (mood === "low") {
    add("watch", "Your well-being is a bit low",
      hasSchedule
        ? "Keep your sleep steady and put something restful in your timetable, even 30 minutes."
        : "Lighten what you can and put something restful on the calendar.");
  }

  if (stress === "high") {
    add("watch", "Stress is running high",
      heavyWeek
        ? "Work in 25-minute blocks with a 5-minute break, and choose one task a day that has to get done. The rest can wait its turn."
        : "Your week isn't heavy, so this stress may be coming from somewhere else. A friend, a walk or the guidance office can all help.");
  } else if (stress === "moderate") {
    add("info", "Some stress showing",
      hasTasks ? "Tackle one thing at a time and take short breaks between study blocks." : "A short walk or a break from screens goes a long way while things are calm.");
  } else if (stress === "low" && heavyWeek && mood !== "low" && mood !== "very-low") {
    add("good", "You're handling it well", "Your check-in shows low stress, so a full week is manageable. Keep your sleep and meals steady.");
  }

  // ---- Classes ----
  if (hasSchedule) {
    const early = days.slice(1, 3)
      .map((d, k) => ({ d, i: k + 1, first: d.entries.filter((e) => e.kind === "class").sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))[0] }))
      .find(({ first }) => first && toMinutes(first.startTime) < EARLY_START_MINUTES);
    if (early) {
      add(struggling ? "watch" : "info", `Early start ${early.i === 1 ? "tomorrow" : `on ${weekdayLong(early.d.key)}`}`,
        `${early.first.title} starts at ${formatTime(early.first.startTime)}. Finish studying early the night before so you get enough sleep.`);
    }

    const longDay = days.slice(0, 4).find((d) => d.busyHours >= LONG_DAY_HOURS && d.key !== over?.d.key);
    if (longDay) {
      const i = days.indexOf(longDay);
      add("info", `${dayName(longDay, i)} is a long day`,
        `${round1(longDay.busyHours)}h of classes and activities. Plan meals and a break, and save the heavy studying for a lighter day.`);
    }
  }

  // ---- What to do next ----
  if (upcoming) {
    const hours = Number(upcoming.task.hours) || 0;
    const perDay = upcoming.daysLeft > 0 ? Math.max(0.5, Math.ceil((hours / upcoming.daysLeft) * 2) / 2) : hours;
    add("info", `Next deadline: ${upcoming.task.title}`,
      upcoming.daysLeft === 0
        ? `Due today, with about ${hours}h of work. Do it before anything else.`
        : `Due ${dueText(upcoming.daysLeft)}, about ${hours}h of work. ${upcoming.daysLeft > 1 ? `Around ${perDay}h a day gets it done without a last-minute rush.` : "Start today so tomorrow isn't a scramble."}`);
  }

  const gap = hasTasks && hasSchedule ? findGap(days, now) : null;
  if (gap) {
    add("good", `${dayName(days[gap.dayIndex], gap.dayIndex)} has a free window`,
      `You're free between ${formatTime(`${String(Math.floor(gap.from / 60)).padStart(2, "0")}:${String(gap.from % 60).padStart(2, "0")}`)} and ${formatTime(gap.after.startTime)} (${durationText(gap.to - gap.from)}), a good slot for ${upcoming ? upcoming.task.title : "your next task"}.`);
  }

  const holidays = days.filter((d) => d.holiday);
  if (holidays.length) {
    const first = holidays[0];
    add("info", `${weekdayLong(first.key)} is a day off`,
      `${first.holiday}. Classes marked to skip are left out of this week's numbers. Use the time to ${hasTasks ? "catch up or to recharge" : "recharge"}.`);
  }

  const easiest = days
    .map((d, i) => ({ d, i, room: d.capacity - d.load }))
    .filter(({ d, i, room }) => i > 0 && d.load < 0.5 && room >= 2 && d.key !== over?.d.key)
    .sort((a, b) => b.room - a.room)[0];
  if (easiest && hasTasks && !gap) {
    add("good", `${weekdayLong(easiest.d.key)} looks light`,
      `${easiest.d.busyHours > 0 ? `Only ${round1(easiest.d.busyHours)}h is booked.` : "Nothing is booked."} Good for getting ahead on something, or keeping it free to rest.`);
  }

  // ---- The task mix ----
  if (values.difficulty !== null && values.difficulty > 50) {
    add("info", "A lot of hard tasks",
      stress === "high" ? "Split each difficult task into small steps you can finish in one sitting, and ask a classmate or teacher early."
        : "Split the difficult ones into smaller steps, and ask a classmate or teacher early instead of late.");
  }
  if (values.priority !== null && values.priority > 60) {
    add("info", "Most of your hours are high priority", "Start with the most urgent one, and let the rest wait their turn.");
  }

  // ---- Missing data, said plainly ----
  const staleNotes = [];
  if (pssStatus === "stale") staleNotes.push(`stress check-in is ${pssAgeDays} days old`);
  if (whoStatus === "stale") staleNotes.push(`well-being check-in is ${whoAgeDays} days old`);
  if (staleNotes.length) {
    add("info", "Time for a fresh check-in",
      `Your ${staleNotes.join(" and your ")}, so ${staleNotes.length > 1 ? "they aren't" : "it isn't"} counted in your score right now. Retake ${staleNotes.length > 1 ? "them" : "it"} to keep the guidance accurate.`);
  } else if (pssStatus === "never" && whoStatus === "never") {
    add("info", "Take a check-in", "The score is based on your tasks and schedule for now. A short check-in makes it more personal.");
  }

  if (!hasTasks) {
    add("info", "Nothing on your task list",
      hasSchedule
        ? "If something is due, add it so the plan can work around your classes. If not, this is a good time to rest or get ahead."
        : "Add a task or your class schedule and the plan starts to fill in.");
  }
  if (!hasSchedule) {
    add("info", "Add your class schedule", "Your workload can only count classes once your timetable is in. It takes a couple of minutes.");
  }

  // ---- Modes ----
  if (isExamWeek) {
    add("watch", "Exam week", "Pause the non-essentials and put your energy into revision and sleep.");
  }
  if (goal < 0) add("info", "Recovery mode", "Your goal is catching up, so the score is a little gentler and the tips favour rest.");
  if (goal > 0) add("info", "High-performance mode", "Your goal is high performance, so the score allows a heavier load before it warns you.");

  if (!tips.some((t) => t.tone === "alert" || t.tone === "watch" || t.tone === "good")) {
    add("good",
      !hasTasks ? "All clear" : workloadScore <= 30 ? "A light week" : "You're on track",
      !hasTasks ? "Nothing is due, so there's room to rest or plan ahead."
        : workloadScore <= 30 ? "There's room to get ahead, or just to rest. Both count."
          : "Keep the pace steady and check back as new deadlines arrive.");
  }

  return tips.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, MAX_TIPS);
}
