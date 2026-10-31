import { Link } from "react-router-dom";
import BusySpinner from "./BusySpinner";
import "./button.css";

// The one button. `to` renders a router Link with the same look. `busy` shows the spinner and
// disables it. `icon` is an optional leading lucide icon component.
// variant: primary | secondary | ghost | danger. size: md (44px) | sm (36px).
export default function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  busy = false,
  to,
  type = "button",
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  const classes = `ui-btn ui-btn--${variant} ui-btn--${size} ${className}`.trim();
  const content = (
    <>
      {busy ? <BusySpinner /> : Icon && <Icon size={18} aria-hidden="true" />}
      <span>{children}</span>
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {content}
    </button>
  );
}
