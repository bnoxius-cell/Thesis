import { useId } from "react";
import "./field.css";

// A labelled form field: label, control, then a hint or an error line, wired with ids and
// aria-describedby. By default the control is an <input> (or a <textarea> with `multiline`) and
// the other props go to it. For another control (SelectButton, Segment), pass a function as the
// child; it gets { id, labelId, "aria-describedby", "aria-invalid" } to spread on that control.
export default function Field({ label, hint, error, multiline = false, className = "", children, id, ...control }) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const labelId = `${controlId}-label`;
  const note = error || hint;
  const noteId = note ? `${controlId}-note` : undefined;
  const wiring = { id: controlId, "aria-describedby": noteId, "aria-invalid": error ? true : undefined };

  const Control = multiline ? "textarea" : "input";
  return (
    <div className={`ui-field ${className}`.trim()}>
      <label id={labelId} htmlFor={controlId} className="ui-field__label">
        {label}
      </label>
      {typeof children === "function" ? (
        children({ ...wiring, labelId })
      ) : (
        <Control className="ui-field__control" {...wiring} {...control} />
      )}
      {note && (
        <p id={noteId} className={error ? "ui-field__error" : "ui-field__hint"} role={error ? "alert" : undefined}>
          {note}
        </p>
      )}
    </div>
  );
}
