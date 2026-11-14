import { useCallback, useState } from "react";
import { addEntry, addMyEntry, updateEntry } from "@/shared/api/schedules";
import { entryPayload } from "@/utils/entryForm";

// Saves one entry. Adding: with a `schedule` (a picked timetable the student can edit) it goes there; without
// one it goes to the student's main timetable, which the server creates when they have none. Editing: pass the
// `stored` entry too, and the form's fields are put on top of it (entryPayload keeps what the form doesn't show).
// save() answers { schedule } (the timetable after the change) on success, { gone: true } when the server says
// the entry isn't there anymore, and {} after any other failure. After a failure `error` holds the server's
// plain message and the dialog stays open.
export default function useSaveEntry() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = useCallback(async (form, schedule, stored) => {
    setSaving(true);
    setError("");
    const payload = entryPayload(form, stored);
    let result;
    if (stored) result = await updateEntry(schedule._id, stored._id, payload);
    else result = await (schedule ? addEntry(schedule._id, payload) : addMyEntry(payload));
    setSaving(false);
    if (result.error) {
      if (stored && result.status === 404 && result.fromApi) return { gone: true };
      setError(result.error);
      return {};
    }
    return { schedule: result.data.schedule };
  }, []);

  return { save, saving, error };
}
