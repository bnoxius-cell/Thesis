import { dayLabel } from "./chatTime";
import { messageKey } from "./chatMessages";

const RUN_GAP_MS = 5 * 60 * 1000;

const dayOf = (iso) => new Date(iso).toDateString();

// Turns messages into what the list draws: a day chip whenever the day changes, and runs. A run is
// consecutive messages from one person within five minutes: they share one name-and-time line and
// one avatar. Keys come from the first message of a run, so a new message joins the last run
// without remounting anything.
export function buildTimeline(messages, myId, now = new Date()) {
  const items = [];
  let run = null;
  let day = null;

  messages.forEach((m) => {
    const senderId = m.sender?._id ?? null;
    if (dayOf(m.createdAt) !== day) {
      day = dayOf(m.createdAt);
      items.push({ kind: "day", key: `day-${messageKey(m)}`, label: dayLabel(m.createdAt, now) });
      run = null;
    }
    const last = run?.messages[run.messages.length - 1];
    const joins = run && run.senderId === senderId && new Date(m.createdAt) - new Date(last.createdAt) < RUN_GAP_MS;
    if (joins) {
      run.messages.push(m);
    } else {
      run = { kind: "run", key: `run-${messageKey(m)}`, senderId, mine: senderId === myId, sender: m.sender, messages: [m] };
      items.push(run);
    }
  });
  return items;
}
