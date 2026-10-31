import { useCallback, useState } from "react";
import { createSubject, updateSubject } from "@/shared/api/subjects";
import { subjectPayload } from "./subjectForm";

// Creates a subject, or saves changes to `subject` when one is given. save() answers true when it
// worked; otherwise `error` holds the server's plain message and the dialog stays open.
export default function useSaveSubject(subject) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = useCallback(async (form) => {
    setSaving(true);
    setError("");
    const fields = subjectPayload(form);
    const { error: failure } = subject ? await updateSubject(subject._id, fields) : await createSubject(fields);
    setSaving(false);
    if (failure) setError(failure);
    return !failure;
  }, [subject]);

  return { save, saving, error };
}
