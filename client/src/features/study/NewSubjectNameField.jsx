import { Field } from "@/shared/ui";
import { SUBJECT_LIMITS } from "./subjectForm";

// The Name field that opens under a Subject dropdown once "New subject..." is picked (the class, reviewer,
// task and deck forms). Takes the focus as it appears; `onChange` gets the input event, like Field's.
export default function NewSubjectNameField({ value, onChange, error, disabled }) {
  return (
    <Field
      className="is-entering"
      label="Subject name"
      value={value}
      onChange={onChange}
      error={error}
      maxLength={SUBJECT_LIMITS.name}
      autoComplete="off"
      autoFocus
      required
      disabled={disabled}
    />
  );
}
