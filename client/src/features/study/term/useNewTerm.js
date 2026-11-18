import { useCallback, useEffect, useMemo, useState } from "react";
import { applyNewTerm, fetchSubjects } from "@/shared/api/subjects";
import { fetchMainTimetable } from "@/shared/api/schedules";
import {
  addClassTime,
  addSubject,
  changeClassTime,
  changeSubject,
  clashNotes,
  emptyTermForm,
  keptEntries,
  nothingToApply,
  removeClassTime,
  removeSubject,
  setArchived,
  setTermField,
  termErrors,
  termRequest,
  termStarted,
} from "./newTermForm";

export const STEP = { pick: 0, add: 1, review: 2, done: 3 };
const NOTHING = "Tick a subject to archive, or add a subject for this term.";

// The New term wizard's state: what it loads (active subjects and the main timetable, for the clash notes), the
// form, the step, and the one request that applies it.
//   status    "loading" | "ready" | "failed" (the load), with `error` and `reload`
//   subjects  the active subjects; `timetable` the main timetable or null (the server makes one on apply)
//   form      the form (null until loaded); change it with the functions below, each takes the form's next shape
//   step      a STEP value; `started` is true once anything was typed (closing asks first); `result` is the answer
//   errors    per-row messages, once a Next was refused; `notes` the clash warnings; `message` a line about the whole form
export default function useNewTerm() {
  const [load, setLoad] = useState({ status: "loading", error: "", subjects: [], timetable: null });
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState(null);
  const [start, setStart] = useState(null);
  const [step, setStep] = useState(STEP.pick);
  const [showErrors, setShowErrors] = useState(false);
  const [message, setMessage] = useState("");
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSubjects(), fetchMainTimetable()]).then(([subjectRes, timetableRes]) => {
      if (cancelled) return;
      if (subjectRes.error) {
        setLoad({ status: "failed", error: subjectRes.error, subjects: [], timetable: null });
        return;
      }
      const subjects = subjectRes.data.subjects;
      const first = emptyTermForm(subjects);
      setForm(first);
      setStart(first);
      setLoad({ status: "ready", error: "", subjects, timetable: timetableRes.data?.schedule ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setLoad((prev) => ({ ...prev, status: "loading" }));
    setAttempt((n) => n + 1);
  }, []);

  const edit = (change) => {
    setForm(change);
    setMessage("");
  };

  // After a failed Next the messages stay on the rows and follow what is typed.
  const errors = useMemo(() => (showErrors && form ? termErrors(form) : {}), [showErrors, form]);

  const notes = useMemo(
    () => (form ? clashNotes(form, keptEntries(load.timetable?.entries, form.archiveIds)) : {}),
    [form, load.timetable],
  );

  const next = () => {
    if (step === STEP.add) {
      if (Object.keys(termErrors(form)).length > 0) return setShowErrors(true);
      if (nothingToApply(form)) return setMessage(NOTHING);
    }
    setStep(step + 1);
  };
  const back = () => {
    setMessage("");
    setStep(step - 1);
  };

  const apply = async () => {
    setApplying(true);
    setMessage("");
    const { data, error } = await applyNewTerm(termRequest(form));
    setApplying(false);
    if (error) return setMessage(error);
    setResult(data);
    setStep(STEP.done);
  };

  return {
    ...load,
    reload,
    form,
    step,
    started: Boolean(form && start && step !== STEP.done && termStarted(form, start)),
    errors,
    notes,
    message,
    applying,
    result,
    next,
    back,
    apply,
    archive: (ids) => edit((f) => setArchived(f, ids)),
    setField: (field, value) => edit((f) => setTermField(f, field, value)),
    addSubject: () => edit(addSubject),
    changeSubject: (key, fields) => edit((f) => changeSubject(f, key, fields)),
    removeSubject: (key) => edit((f) => removeSubject(f, key)),
    addClassTime: (key) => edit((f) => addClassTime(f, key)),
    changeClassTime: (key, timeKey, fields) => edit((f) => changeClassTime(f, key, timeKey, fields)),
    removeClassTime: (key, timeKey) => edit((f) => removeClassTime(f, key, timeKey)),
  };
}
