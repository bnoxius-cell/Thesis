import { useId } from "react";

// One row of a settings card: a label with an optional hint on the left, the control on the right
// (`children` gets the label's id so it can name itself), and a plain error line under both.
export default function SettingsRow({ label, hint, error, children }) {
  const id = useId();
  return (
    <div className="settings-row">
      <div className="settings-row__text">
        <span id={id} className="settings-row__label">{label}</span>
        {hint && <span className="settings-row__hint">{hint}</span>}
      </div>
      {children && <div className="settings-row__control">{typeof children === "function" ? children(id) : children}</div>}
      {error && <p className="settings-row__error" role="alert">{error}</p>}
    </div>
  );
}

// A titled card holding rows (frame 276:3: 20px title, rows divided by a hairline).
export function SettingsGroup({ title, children }) {
  const id = useId();
  return (
    <section className="settings-group" aria-labelledby={id}>
      <h2 id={id} className="settings-group__title">{title}</h2>
      {children}
    </section>
  );
}
