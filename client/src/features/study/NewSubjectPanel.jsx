import { Field } from "@/shared/ui";
import { SUBJECT_LIMITS } from "./subjectForm";
import "./new-subject-panel.css";

// The panel that opens under the Subject select once "New subject..." is picked in the class time form
// (Figma MS-3 407:989): a Name and an optional Code. The Name takes the focus as the panel appears. `onName` and
// `onCode` get the input event, like Field's `onChange`.
export default function NewSubjectPanel({ name, code, onName, onCode, error, disabled }) {
  return (
    <div className="new-subject-panel is-entering" role="group" aria-label="New subject">
      <p className="new-subject-panel__label" aria-hidden="true">New subject</p>
      <div className="new-subject-panel__fields">
        <Field
          label="Name"
          value={name}
          onChange={onName}
          error={error}
          maxLength={SUBJECT_LIMITS.name}
          autoComplete="off"
          autoFocus
          required
          disabled={disabled}
        />
        <Field
          label="Code (optional)"
          className="new-subject-panel__code"
          value={code}
          onChange={onCode}
          maxLength={SUBJECT_LIMITS.code}
          autoComplete="off"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
