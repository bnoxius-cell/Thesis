import { useEffect } from "react";
import Badge from "./Badge";
import "./icon-button.css";

// An icon-only button. `label` is required: it becomes the accessible name. The visual is 36px,
// the hit area 44px. `badge` is an optional count on the corner (hidden at 0). `plain` drops the
// outline, for a close button in a dialog title row.
export default function IconButton({ label, icon: Icon, badge = 0, plain = false, type = "button", className = "", ...rest }) {
  useEffect(() => {
    if (import.meta.env.DEV && !label) console.warn("IconButton needs a label for screen readers.");
  }, [label]);

  return (
    <button type={type} className={`ui-icon-btn ${plain ? "ui-icon-btn--plain" : ""} ${className}`.trim()} aria-label={label} {...rest}>
      <span className="ui-icon-btn__face">
        <Icon size={20} aria-hidden="true" />
      </span>
      <Badge count={badge} className="ui-icon-btn__badge" />
    </button>
  );
}
