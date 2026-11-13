import { useCallback, useState } from "react";
import { addEntry, addMyEntry } from "@/shared/api/schedules";
import { entryPayload } from "@/utils/entryForm";

// Adds one entry. With a `schedule` (a picked timetable the student can edit) it goes there; without one it
// goes to the student's main timetable, which the server creates when they have none. save() answers the
// timetable after the change, or null after a failure, when `error` holds the server's plain message and
// the dialog stays open.
export default function useSaveEntry() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = useCallback(async (form, schedule) => {
    setSaving(true);
    setError("");
    const payload = entryPayload(form);
    const { data, error: failure } = await (schedule ? addEntry(schedule._id, payload) : addMyEntry(payload));
    setSaving(false);
    if (failure) {
      setError(failure);
      return null;
    }
    return data.schedule;
  }, []);

  return { save, saving, error };
}
