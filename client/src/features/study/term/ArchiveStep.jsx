import { Archive, ArrowRight, Check } from "lucide-react";
import { Button } from "@/shared/ui";
import { plural } from "@/shared/lib/plural";

// Step 1 (TR-2): which of the active subjects are done. Every one starts ticked; a subject the student takes
// again is unticked and simply stays active. Nothing is archived until the last step.
export default function ArchiveStep({ subjects, selected, onChange, onCancel, onNext }) {
  const everything = selected.length === subjects.length;
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id]);

  return (
    <>
      {subjects.length > 0 ? (
        <>
          <div className="term-list-top">
            <p className="term-count" aria-live="polite">{selected.length} of {subjects.length} selected</p>
            <button type="button" className="term-link" onClick={() => onChange(everything ? [] : subjects.map((subject) => subject._id))}>
              {everything ? "Clear all" : "Select all"}
            </button>
          </div>
          <ul className="term-picks">
            {subjects.map((subject) => {
              const times = subject.counts.classTimes;
              return (
                <li key={subject._id}>
                  <label className="term-pick">
                    <input type="checkbox" checked={selected.includes(subject._id)} onChange={() => toggle(subject._id)} />
                    <span className="term-pick__tick" aria-hidden="true"><Check size={20} /></span>
                    <span className="term-pick__text">
                      <span className="term-pick__name">{subject.name}</span>
                      {subject.code && <span className="term-pick__code">{subject.code}</span>}
                    </span>
                    <span className="term-pick__times">{times > 0 ? plural(times, "class time") : "No class times"}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="term-note">
            <Archive size={20} aria-hidden="true" />
            <span>Tasks, reviewers, flashcards and files stay with each subject. You can restore a subject any time.</span>
          </p>
        </>
      ) : (
        <p className="term-note">You have no active subjects, so there is nothing to archive. Go on to add this term&apos;s.</p>
      )}
      <div className="term-actions">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button icon={ArrowRight} onClick={onNext}>Next</Button>
      </div>
    </>
  );
}
