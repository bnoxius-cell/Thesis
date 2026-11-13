// Which release notes a student still has to see. Pure, so the server tests can import it.
// `notes` is newest first. Returns the unseen entries (newest first) and whether this is a brand-new
// account, which gets no window: it is marked seen silently.
export function unseenNotes(notes, seenId, createdAt) {
  if (notes.length === 0 || seenId === notes[0].id) return { entries: [], silent: false };
  if (!seenId) {
    const releasedAt = new Date(`${notes[0].id.slice(0, 10)}T00:00:00`);
    if (createdAt && new Date(createdAt) >= releasedAt) return { entries: [], silent: true };
    return { entries: [notes[0]], silent: false };
  }
  const at = notes.findIndex((note) => note.id === seenId);
  return { entries: at < 0 ? [notes[0]] : notes.slice(0, at), silent: false };
}
