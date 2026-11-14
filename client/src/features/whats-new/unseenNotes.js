// Which release notes a student still has to see. Pure, so the server tests can import it.
// `notes` is newest first. Returns the unseen entries (newest first) and whether this is a brand-new
// account, which gets no window: it is marked seen silently.
// `seenId` is the last version the student saw (an entry's `version`: its id plus its item count, so adding
// items to a day's file shows it again). Accounts saved before versions existed hold a bare id: that counts
// as the entry's old content, so only the newest entry is shown again for them, once.
const versionOf = (note) => note.version ?? note.id;

export function unseenNotes(notes, seenId, createdAt) {
  if (notes.length === 0 || seenId === versionOf(notes[0])) return { entries: [], silent: false };
  if (!seenId) {
    const releasedAt = new Date(`${notes[0].id.slice(0, 10)}T00:00:00`);
    if (createdAt && new Date(createdAt) >= releasedAt) return { entries: [], silent: true };
    return { entries: [notes[0]], silent: false };
  }
  const at = notes.findIndex((note) => versionOf(note) === seenId || note.id === seenId);
  if (at < 0) return { entries: [notes[0]], silent: false };
  const changed = at === 0 && versionOf(notes[0]) !== seenId;
  return { entries: notes.slice(0, changed ? 1 : at), silent: false };
}
