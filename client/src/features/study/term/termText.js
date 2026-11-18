import { plural } from "../../../shared/lib/plural.js";

// The words that report what archiving, restoring and a new term did. Pure, so the server tests can run them.

// What a new term did (TR-4): { headline, skipped }. `result` is the server's answer { archived, subjects,
// classTimesAdded, skipped }, `timetable` the name of the main timetable the classes went into.
export function newTermText(result, timetable) {
  const parts = [];
  if (result.archived > 0) parts.push(`${plural(result.archived, "subject")} archived`);
  if (result.subjects.length > 0 || result.classTimesAdded > 0) {
    parts.push(`${plural(result.subjects.length, "subject")} and ${plural(result.classTimesAdded, "class time")} added to ${timetable}`);
  }
  return {
    headline: parts.length > 0 ? `${parts.join(". ")}.` : "Nothing needed changing.",
    skipped: result.skipped > 0 ? `${plural(result.skipped, "class time")} ${result.skipped === 1 ? "was" : "were"} already there, so we skipped ${result.skipped === 1 ? "it" : "them"}.` : "",
  };
}

// The toast after a restore. `result` is the server's { classTimesAdded, timetableFull }.
export function restoreText(name, result) {
  if (result.timetableFull) return `${name} is back. Your timetable is full, so its class times weren't added.`;
  if (result.classTimesAdded > 0) return `${name} is back, with ${plural(result.classTimesAdded, "class time")} in your timetable.`;
  return `${name} is back.`;
}
