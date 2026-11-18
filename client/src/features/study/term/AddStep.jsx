import { ArrowRight } from "lucide-react";
import { Button, Field } from "@/shared/ui";
import { TERM_MAX } from "./newTermForm";
import TermSubjectRows from "./TermSubjectRows";

// Step 2 (TR-3): the term's name and first day, then the subjects with their class times. The first day is
// optional so a student can set the term up during the break; without it the classes show from now on.
export default function AddStep({ term }) {
  const { form } = term;
  return (
    <>
      <div className="term-fields">
        <Field
          label="Term name (optional)"
          value={form.term}
          maxLength={TERM_MAX}
          placeholder="e.g. 2nd Sem 2025-26"
          autoComplete="off"
          onChange={(e) => term.setField("term", e.target.value)}
        />
        <Field
          label="First day of classes (optional)"
          type="date"
          value={form.firstDay}
          hint="New class times start from this day."
          onChange={(e) => term.setField("firstDay", e.target.value)}
        />
      </div>
      <TermSubjectRows term={term} />
      {term.message && <p className="term-error" role="alert">{term.message}</p>}
      <div className="term-actions">
        <Button variant="secondary" onClick={term.back}>Back</Button>
        <Button icon={ArrowRight} onClick={term.next}>Next</Button>
      </div>
    </>
  );
}
