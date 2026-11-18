import { WEEKDAYS } from "./scheduleUtils.js";

// A class time that can have a different time on each day (P7a). Pure helpers, no React, so the server tests can run
// them. A "class time" here is { days, startTime, endTime, sameTime, dayTimes }: with `sameTime` (the default) every
// picked day shares startTime and endTime; with `sameTime: false` each picked day has its own times in `dayTimes`
// ({ [day]: { startTime, endTime } }, days are Date#getDay numbers). Nothing new is stored: groupTimes turns the
// per-day times back into today's entries, one per distinct start and end, each with the days that share them.
const ORDER = Object.fromEntries(WEEKDAYS.map((day, index) => [day.value, index]));
const LONG = Object.fromEntries(WEEKDAYS.map((day) => [day.value, day.long]));

// Monday first, like the day picker.
export const inWeekOrder = (days) => [...days].sort((a, b) => ORDER[a] - ORDER[b]);

export const isPerDay = (time) => time.sameTime === false;

const timesOf = (time, day) => time.dayTimes?.[day] ?? { startTime: time.startTime, endTime: time.endTime };

// One row per picked day, Monday first: [{ day, startTime, endTime }].
export const dayTimeRows = (time) => inWeekOrder(time.days).map((day) => ({ day, ...timesOf(time, day) }));

// The picked days changed. With a time for each day, a newly picked day copies the last row's times and an
// unpicked day takes its times with it.
export function setDays(time, days) {
  if (!isPerDay(time)) return { ...time, days };
  const rows = dayTimeRows(time);
  const seed = rows[rows.length - 1] ?? { startTime: time.startTime, endTime: time.endTime };
  const dayTimes = {};
  for (const day of days) {
    const { startTime, endTime } = time.dayTimes?.[day] ?? seed;
    dayTimes[day] = { startTime, endTime };
  }
  return { ...time, days, dayTimes };
}

// The switch flipped. Off gives every picked day the shared time to start from; on gives all days the first
// day's times.
export function setSameTime(time, same) {
  const rows = dayTimeRows(time);
  if (same) {
    const [first] = rows;
    return { ...time, sameTime: true, dayTimes: {}, ...(first && { startTime: first.startTime, endTime: first.endTime }) };
  }
  const dayTimes = Object.fromEntries(rows.map(({ day, startTime, endTime }) => [day, { startTime, endTime }]));
  return { ...time, sameTime: false, dayTimes };
}

export const changeDayTime = (time, day, fields) => ({ ...time, dayTimes: { ...time.dayTimes, [day]: { ...timesOf(time, day), ...fields } } });

// The weekday "Add another day" picks: the first free one after the last picked day, else the first free one of
// the week. undefined when all seven are picked.
export function nextFreeDay(days) {
  const week = WEEKDAYS.map((day) => day.value);
  const lastIndex = Math.max(-1, ...days.map((day) => ORDER[day]));
  const free = (day) => !days.includes(day);
  return week.slice(lastIndex + 1).find(free) ?? week.find(free);
}

// "Add another day": the next free weekday, with the last row's times copied onto it.
export function addNextDay(time) {
  const day = nextFreeDay(time.days);
  return day === undefined ? time : setDays(time, [...time.days, day]);
}

// What to save: [{ days, startTime, endTime }], one per distinct pair of times, days Monday first. A class time
// that shares one time is a single group.
export function groupTimes(time) {
  if (!isPerDay(time)) return [{ days: inWeekOrder(time.days), startTime: time.startTime, endTime: time.endTime }];
  const groups = [];
  for (const { day, startTime, endTime } of dayTimeRows(time)) {
    const group = groups.find((found) => found.startTime === startTime && found.endTime === endTime);
    if (group) group.days.push(day);
    else groups.push({ days: [day], startTime, endTime });
  }
  return groups;
}

// What is wrong with the times, as { day, message } (day is null when they share one time), or null when fine.
// With a time for each day the message names the day and `day` says which row to mark.
export function timeProblem(time) {
  if (isPerDay(time)) {
    for (const { day, startTime, endTime } of dayTimeRows(time)) {
      if (!startTime || !endTime) return { day, message: `Set a start and an end time for ${LONG[day]}.` };
      if (endTime <= startTime) return { day, message: `${LONG[day]} ends before it starts. Pick a later end time.` };
    }
    return null;
  }
  if (!time.startTime || !time.endTime) return { day: null, message: "Set a start and an end time." };
  if (time.endTime <= time.startTime) return { day: null, message: "The end time must be after the start time." };
  return null;
}
