// What the "What's in front of you" panel should show at a given moment. It leans on the
// clock: a class that finished this morning is history by the afternoon, and after the last
// class of the day the useful thing to look at is tomorrow.

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const byStart = (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime);

export function phaseFor(now) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const KICKER = {
  morning: "This morning",
  afternoon: "This afternoon",
  evening: "This evening",
  night: "Tonight",
};

// today / tomorrow: days from buildWeek (entries, holiday). tasks: open tasks with `daysLeft`
// already worked out (see getTaskMetrics).
export function buildFocus({ today, tomorrow, tasks, now = new Date() }) {
  const phase = phaseFor(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const entries = [...today.entries].sort(byStart);
  const happeningNow = entries.filter((e) => toMinutes(e.startTime) <= nowMinutes && toMinutes(e.endTime) > nowMinutes);
  const laterToday = entries.filter((e) => toMinutes(e.startTime) > nowMinutes);
  const finished = entries.filter((e) => toMinutes(e.endTime) <= nowMinutes);

  const byUrgency = [...tasks].sort((a, b) => a.daysLeft - b.daysLeft || b.workload - a.workload);
  const dueSoon = byUrgency.filter((t) => t.daysLeft <= 1);
  const nextTask = byUrgency.find((t) => t.daysLeft > 1) || null;

  // Nothing more is happening today, so tomorrow is what the student is really facing.
  const dayIsOver = happeningNow.length === 0 && laterToday.length === 0;
  const showTomorrow = phase === "evening" || phase === "night" || (dayIsOver && entries.length > 0);
  const tomorrowEntries = tomorrow ? [...tomorrow.entries].sort(byStart) : [];

  let heading;
  if (happeningNow.length) heading = "Happening now";
  else if (laterToday.length) heading = "Coming up today";
  else if (entries.length) heading = "Done for the day";
  else if (dueSoon.length) heading = "What needs attention";
  else heading = "Nothing pressing";

  return {
    phase,
    kicker: KICKER[phase],
    heading,
    happeningNow,
    laterToday,
    finishedCount: finished.length,
    dueSoon: dueSoon.slice(0, 5),
    nextTask,
    dayIsOver,
    tomorrow: showTomorrow
      ? { holiday: tomorrow?.holiday || null, entries: tomorrowEntries.slice(0, 4), moreEntries: Math.max(0, tomorrowEntries.length - 4) }
      : null,
    // No open tasks at all: the panel offers a calm "you're all caught up" instead of an empty list.
    caughtUp: tasks.length === 0,
  };
}
