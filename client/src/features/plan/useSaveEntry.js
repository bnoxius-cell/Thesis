import { useCallback, useState } from "react";
import { addEntry, addMyEntry, customizeClass, fetchTimetable, updateEntry } from "@/shared/api/schedules";
import { entryPayload } from "@/utils/entryForm";

// Saves one entry. Adding: with a `schedule` (a picked timetable the student can edit) it goes there; without
// one it goes to the student's main timetable, which the server creates when they have none. Editing: pass the
// `stored` entry too, and the form's fields are put on top of it (entryPayload keeps what the form doesn't show).
// save() answers { schedule } (the timetable after the change) on success, { gone: true } when the server says
// the entry isn't there anymore, and {} after any other failure. After a failure `error` holds the server's
// plain message and the dialog stays open.
// saveMine() is "just for me" on a class of a timetable shared with the student: it makes their own copy of the
// shared class (the same copy again on a retry), then puts the form's fields on the copy. It answers like save().
export default function useSaveEntry() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      const payload = entryPayload(form, stored);
      const missing = (result) => Boolean(stored) && result.status === 404 && result.fromApi;
      if (stored) return finish(() => updateEntry(schedule._id, stored._id, payload), missing);
      return finish(() => (schedule ? addEntry(schedule._id, payload) : addMyEntry(payload)));
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
