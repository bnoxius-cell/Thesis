import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button, ConfirmDialog, ModalShell, Skeleton } from "@/shared/ui";
import AddStep from "./AddStep";
import ArchiveStep from "./ArchiveStep";
import DoneStep from "./DoneStep";
import ReviewStep from "./ReviewStep";
import TermHeader from "./TermHeader";
import useNewTerm, { STEP } from "./useNewTerm";

const HEADINGS = [
  { title: "Which subjects are done?", subtitle: "Done subjects move to Archived. Untick a subject if you are taking it again." },
  { title: "What are you taking this term?", subtitle: "Add each subject with its class times. You can change anything later in Plan." },
  { title: "Check it before we apply it", subtitle: "Nothing changes until you tap Apply changes." },
];

// Start a new term (Figma TR-2 to TR-4, desktop 381:2309 and phone 381:2670): a focus view with no shell, in three
// steps and then a "done" screen. It sits on ModalShell, so it traps focus, locks the page behind it and closes on
// Escape like every dialog, but it fills the screen with the Exit button the frames draw. Closing asks first when
// anything was typed. `onApplied` runs when it closes after the term was applied, so the page can read its lists again.
export default function NewTermDialog({ onClose, onApplied }) {
  const term = useNewTerm();
  const navigate = useNavigate();
  const titleId = useId();
  const headerRef = useRef(null);
  const shownStep = useRef(term.step);
  const [leaving, setLeaving] = useState(false);

  // A new step moves focus to its heading (and back into view).
  useEffect(() => {
    if (shownStep.current === term.step) return;
    shownStep.current = term.step;
    headerRef.current?.focus();
  }, [term.step]);

  // The page behind reads its lists again only now: it may drop the control that opened this (Plan reloads its
  // timetable list), and that would take the "done" screen with it.
  const close = () => {
    onClose();
    if (term.result) onApplied?.(term.result);
  };
  const requestClose = () => (term.started ? setLeaving(true) : close());
  const go = (path) => {
    close();
    navigate(path);
  };

  const heading = HEADINGS[Math.min(term.step, HEADINGS.length - 1)];
  const timetable = term.timetable?.title ?? "My timetable";

  let body;
  if (term.status === "loading") {
    body = (
      <div role="status" aria-label="Loading your subjects" className="term-loading">
        <Skeleton className="term-skeleton" height="64px" />
        <Skeleton className="term-skeleton" height="64px" />
        <Skeleton className="term-skeleton" height="64px" />
      </div>
    );
  } else if (term.status === "failed") {
    body = (
      <div className="term-failed" role="alert">
        <p>{term.error}</p>
        <Button variant="secondary" onClick={term.reload}>Try again</Button>
      </div>
    );
  } else if (term.step === STEP.pick) {
    body = <ArchiveStep subjects={term.subjects} selected={term.form.archiveIds} onChange={term.archive} onCancel={requestClose} onNext={term.next} />;
  } else if (term.step === STEP.add) {
    body = <AddStep term={term} />;
  } else if (term.step === STEP.review) {
    body = (
      <ReviewStep
        form={term.form}
        subjects={term.subjects}
        timetable={timetable}
        message={term.message}
        applying={term.applying}
        onBack={term.back}
        onApply={term.apply}
      />
    );
  }

  return (
    <>
      <ModalShell open onClose={requestClose} busy={term.applying} labelledBy={titleId} className="term-focus" overlayClassName="term-overlay">
        <button type="button" className="term-exit" disabled={term.applying} onClick={requestClose}>
          <ArrowLeft size={20} aria-hidden="true" />
          <span>Exit</span>
        </button>
        <div className="term-column">
          {term.step === STEP.done ? (
            <DoneStep result={term.result} timetable={timetable} firstDay={term.form.firstDay} titleId={titleId} headerRef={headerRef} go={go} />
          ) : (
            <>
              <TermHeader step={term.step} {...heading} titleId={titleId} headerRef={headerRef} />
              <div key={term.step} className="term-step tab-panel-in">{body}</div>
            </>
          )}
        </div>
      </ModalShell>
      <ConfirmDialog
        open={leaving}
        sheet
        title="Leave without applying?"
        confirmLabel="Leave"
        cancelLabel="Keep editing"
        onConfirm={close}
        onCancel={() => setLeaving(false)}
      >
        Nothing has changed yet. What you have entered here won&apos;t be saved.
      </ConfirmDialog>
    </>
  );
}
