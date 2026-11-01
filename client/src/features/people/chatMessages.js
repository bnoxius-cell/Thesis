// Pure helpers for the chat's list of messages. A message is the server's message, plus these
// client-only flags: `clientId` (a stable React key from the moment it was typed), `pending` (still
// being sent) and `fresh` (arrived after the chat opened, so it eases in).

export const messageKey = (m) => m.clientId ?? m._id;

// ObjectIds sort by creation time, so ordering by id keeps the chat in order.
const byId = (a, b) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0);

const tombstone = (m, change) => ({
  _id: m._id,
  clientId: m.clientId,
  type: "deleted",
  sender: m.sender,
  createdAt: m.createdAt,
  deleted: true,
  deletedByAdmin: change.deletedByAdmin,
});

// Folds one poll answer into the messages on screen. Messages already shown are skipped (answers
// can overlap), and `changes` turn a message someone removed into its tombstone. Reactions in
// `changes` are ignored: no frame draws them yet.
export function mergeIncoming(prev, { messages = [], changes = [] }, { fresh }) {
  const known = new Set(prev.map((m) => m._id));
  const added = messages.filter((m) => !known.has(m._id)).map((m) => (fresh ? { ...m, fresh: true } : m));
  let next = added.length ? [...prev, ...added].sort(byId) : prev;

  const removed = new Map(changes.filter((c) => c.deleted).map((c) => [c._id, c]));
  if (removed.size) {
    next = next.map((m) => (removed.has(m._id) && !m.deleted ? tombstone(m, removed.get(m._id)) : m));
  }
  return next;
}

// Puts the server's copy of a message we just sent into the list, keeping the key it had while
// pending so the row doesn't remount. A poll may have delivered it first; then that copy gets the key.
export function mergeSent(prev, sent, clientId) {
  if (prev.some((m) => m._id === sent._id)) {
    return prev.map((m) => (m._id === sent._id ? { ...m, clientId } : m));
  }
  return [...prev, { ...sent, clientId, fresh: true }].sort(byId);
}
