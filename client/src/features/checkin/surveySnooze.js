// The Later record for one student and check-in, kept in this browser: { since, count, until }.
// Storage can throw (private windows, blocked site data), so a failed read is "no record" and a failed
// write only means Later doesn't stick.
const keyFor = (userId, kind) => `stresscare:checkin-snooze:${userId || "anonymous"}:${kind}`;

export function readSnooze(userId, kind) {
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(userId, kind)) || "null");
    if (!saved || typeof saved.since !== "string") return null;
    return { since: saved.since, count: Number(saved.count) || 0, until: Number(saved.until) || 0 };
  } catch {
    return null;
  }
}

export function writeSnooze(userId, kind, record) {
  try {
    localStorage.setItem(keyFor(userId, kind), JSON.stringify(record));
  } catch {
    // Later just won't stick.
  }
}
