import { useCallback, useState } from "react";
import { createSubject, updateSubject } from "@/shared/api/subjects";
import { addSubjectPayload } from "./addSubjectForm";
import { subjectPayload } from "./subjectForm";

// Creates a subject (with its class times, from the Add subject form), or saves changes to `subject` when one is
// given. save() answers the saved subject (a new one also says how many class times went on the timetable, as
// `classTimesAdded`); otherwise null, and `error` holds the server's plain message and the dialog stays open.
export default function useSaveSubject(subject) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = useCallback(async (form) => {
    setSaving(true);
    setError("");
    const { data, error: failure } = subject
      ? await updateSubject(subject._id, subjectPayload(form))
      : await createSubject(addSubjectPayload(form));
    setSaving(false);
    if (failure) {
      setError(failure);
      return null;
    }
    return subject ? data.subject : { ...data.subject, classTimesAdded: data.classTimesAdded ?? 0 };
  }, [subject]);

  return { save, saving, error };
}
