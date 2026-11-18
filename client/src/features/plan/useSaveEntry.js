import { useCallback, useRef, useState } from "react";
import { addEntry, addMyEntry, customizeClass, fetchTimetable, updateEntry } from "@/shared/api/schedules";
import { entryPayload, entryPayloads } from "@/utils/entryForm";

// The payload for the subject the first add made, by id, instead of asking for a new one again.
function linkedTo(payload, subject) {
  const linked = { ...payload, subject };
  delete linked.newSubject;
  delete linked.newSubjectCode;
  return linked;
}

// Adds the payloads one after another: the first to `schedule` (or the main timetable), the rest to the timetable
// it answered with. `done` remembers what was added, so a retry after a failure part-way doesn't add it twice;
// a subject the first one made is linked by id in the rest. Answers like a single add (the last answer, or the
// first failure).
async function addEach(payloads, schedule, done) {
  let target = done.schedule ?? schedule;
  let result;
  for (const payload of payloads) {
    const key = JSON.stringify(payload);
    if (done.keys.has(key)) continue;
    const body = done.subject && payload.newSubject ? linkedTo(payload, done.subject) : payload;
    result = await (target ? addEntry(target._id, body) : addMyEntry(body));
    if (result.error) return done.keys.size > 0 ? { ...result, error: `Some days were added. ${result.error}` } : result;
    done.keys.add(key);
    target = result.data.schedule;
    done.schedule = target;
    if (result.data.subject) done.subject = result.data.subject._id;
  }
  return result;
}

// Saves one entry. Adding: with a `schedule` (a picked timetable the student can edit) it goes there; without
// one it goes to the student's main timetable, which the server creates when they have none. A class with a time
// for each day adds one entry per distinct pair of times. Editing: pass the `stored` entry too, and the form's
// fields are put on top of it (entryPayload keeps what the form doesn't show).
// save() answers { schedule } (the timetable after the change) on success, { gone: true } when the server says
// the entry isn't there anymore, and {} after any other failure. After a failure `error` holds the server's
// plain message and the dialog stays open.
// saveMine() is "just for me" on a class of a timetable shared with the student: it makes their own copy of the
// shared class (the same copy again on a retry), then puts the form's fields on the copy. It answers like save().
export default function useSaveEntry() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const added = useRef({ keys: new Set(), schedule: null, subject: null });

  // Runs `send` and turns its answer into save()'s: `gone` is how a missing entry shows in the failure.
  const finish = useCallback(async (send, gone = () => false) => {
    setSaving(true);
    setError("");
    const result = await send();
    setSaving(false);
    if (result.error) {
      if (gone(result)) return { gone: true };
      setError(result.error);
      return {};
    }
    return { schedule: result.data.schedule };
  }, []);

  const save = useCallback(
    (form, schedule, stored) => {
      if (!stored) return finish(() => addEach(entryPayloads(form), schedule, added.current));
      const payload = entryPayload(form, stored);
      const missing = (result) => result.status === 404 && result.fromApi;
      return finish(() => updateEntry(schedule._id, stored._id, payload), missing);
    },
    [finish],
  );

  const saveMine = useCallback(
    (form, schedule, shared) =>
      finish(async () => {
        const made = await customizeClass(schedule._id, shared._id);
        if (made.error) return made;
        const { scheduleId, entryId } = made.data;
        const copies = await fetchTimetable(scheduleId);
        const copy = copies.data?.schedule.entries.find((entry) => entry._id === entryId);
        if (!copy) return { error: copies.error || "Something went wrong. Please try again." };
        // The copy keeps the subject the server linked it to, whatever the shared class showed.
        return updateEntry(scheduleId, entryId, entryPayload({ ...form, subject: copy.subject ?? "" }, copy));
      }, (result) => result.status === 404 && result.fromApi),
    [finish],
  );

  return { save, saveMine, saving, error };
}
