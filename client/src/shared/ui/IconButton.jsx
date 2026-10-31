import { useEffect } from "react";
import { Link } from "react-router-dom";
import Badge from "./Badge";
import "./icon-button.css";

// An icon-only button. `label` is required: it becomes the accessible name. The visual is 36px,
// the hit area 44px. `badge` is an optional count on the corner (hidden at 0). `plain` drops the
// outline, for a close button in a dialog title row. `to` makes it a router link with the same look.
export default function IconButton({ label, icon: Icon, badge = 0, plain = false, to, type = "button", className = "", ...rest }) {
  useEffect(() => {
    if (import.meta.env.DEV && !label) console.warn("IconButton needs a label for screen readers.");
  }, [label]);

  const classes = `ui-icon-btn ${plain ? "ui-icon-btn--plain" : ""} ${className}`.trim();
  const content = (
    <>
      <span className="ui-icon-btn__face">
        <Icon size={20} aria-hidden="true" />
      </span>
      <Badge count={badge} className="ui-icon-btn__badge" />
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={label} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} aria-label={label} {...rest}>
      {content}
    </button>
  );
}
