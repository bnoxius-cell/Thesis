import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Check } from "lucide-react";
import { Button, Modal, Skeleton } from "@/shared/ui";
import { fetchTimetable, setUpClasses } from "@/shared/api/schedules";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import { classRows } from "./classLayer";
import "./join-checklist.css";

const TITLE = "Which of these do you take?";
const HELP = "Tick the classes you attend. The rest stay out of your week. You can change this any time.";
const NOTE = "Saving also turns on Count in my week.";

// Loads the timetable's classes once: { status: "loading" | "ready" | "failed", rows, error }.
function useClassRows(scheduleId) {
  const [state, setState] = useState({ status: "loading", rows: [], error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    fetchTimetable(scheduleId).then(({ data, error }) => {
      if (!current) return;
      setState(data ? { status: "ready", rows: classRows(data.schedule.entries), error: "" } : { status: "failed", rows: [], error });
    });
    return () => {
      current = false;
    };
  }, [scheduleId, attempt]);
  const retry = () => {
    setState({ status: "loading", rows: [], error: "" });
    setAttempt((n) => n + 1);
  };
  return { ...state, retry };
}

// "Which of these do you take?" (Figma GW-5: desktop card 383:2440, phone sheet 383:2786). A member of a shared
// timetable ticks the classes they attend, one row per subject (its lecture and lab are one tick); Save hides the
// rest from their week and turns on Count in my week. Everything starts ticked, or as they left it. It is a card
// on desktop and a bottom sheet on a phone.
//   scheduleId  the shared timetable
//   onSaved     runs after the server saved the answer (the plan reads itself again)
//   onClose     "Not now", and the sheet's own close
export default function JoinChecklist({ scheduleId, onSaved, onClose, revealKey = 0 }) {
  const phone = useMediaQuery("(max-width: 719.98px)");
  const { status, rows, error: loadError, retry } = useClassRows(scheduleId);
  const [off, setOff] = useState(null); // keys switched off, once the student touches a row; until then each row's own answer shows
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sectionRef = useRef(null);

  // On a laptop the checklist opens in the page, maybe far from the button that asked for it: bring it into view
  // and move focus to it so a keyboard or screen reader user lands there too.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
    section.focus({ preventScroll: true });
  }, [revealKey]); // asking again while it is already open scrolls to it again

  const ticked = (row) => (off ? !off.has(row.key) : row.ticked);
  const toggle = (row) =>
    setOff((prev) => {
      const next = new Set(prev ?? rows.filter((item) => !item.ticked).map((item) => item.key));
      if (!next.delete(row.key)) next.add(row.key);
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError("");
    const taking = rows.filter(ticked).flatMap((row) => row.ids);
    const { error: failed } = await setUpClasses(scheduleId, taking);
    setSaving(false);
    if (failed) return setError(failed);
    toast.success("Saved. This timetable now counts in your week.");
    onSaved();
  };

  let list;
  if (status === "loading") {
    list = [0, 1, 2].map((i) => <Skeleton key={i} height="60px" className="join-checklist__skeleton" />);
  } else if (status === "failed") {
    list = (
      <div className="join-checklist__failed" role="alert">
        <p>{loadError}</p>
        <Button variant="secondary" onClick={retry}>Try again</Button>
      </div>
    );
  } else if (rows.length === 0) {
    list = <p className="join-checklist__note">There are no classes on this timetable yet.</p>;
  } else {
    list = rows.map((row) => (
      <label key={row.key} className={`join-row ${ticked(row) ? "is-ticked" : ""}`.trim()}>
        <input type="checkbox" className="join-row__input" checked={ticked(row)} onChange={() => toggle(row)} />
        <span className="join-row__tick" aria-hidden="true">
          <Check size={20} />
        </span>
        <span className="join-row__text">
          <span className="join-row__title">{row.title}</span>
          <span className="join-row__times">{row.times}</span>
        </span>
      </label>
    ));
  }

  const body = (
    <>
      <div className="join-checklist__rows">{list}</div>
      {status === "ready" && rows.length > 0 && <p className="join-checklist__note">{NOTE}</p>}
      {error && <p className="join-checklist__error" role="alert">{error}</p>}
    </>
  );
  const actions = (
    <>
      <Button variant="ghost" onClick={onClose} disabled={saving}>Not now</Button>
      <Button icon={Check} busy={saving} disabled={status !== "ready" || rows.length === 0} onClick={save}>
        Save
      </Button>
    </>
  );

  if (phone) {
    return (
      <Modal sheet title={TITLE} subtitle="Tick the classes you attend. The rest stay out of your week." busy={saving} onClose={onClose} actions={actions} className="join-checklist-sheet">
        {body}
      </Modal>
    );
  }
  return (
    <section ref={sectionRef} tabIndex={-1} className="join-checklist" aria-labelledby="join-checklist-title">
      <div className="join-checklist__head">
        <h3 id="join-checklist-title" className="join-checklist__title">{TITLE}</h3>
        <p className="join-checklist__help">{HELP}</p>
      </div>
      {body}
      <div className="join-checklist__actions">{actions}</div>
    </section>
  );
}
