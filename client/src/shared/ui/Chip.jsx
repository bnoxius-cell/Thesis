import "./chip.css";

// A small status or label pill. tone: accent | good | watch | danger | neutral.
// `icon` is an optional leading lucide icon component.
export default function Chip({ tone = "accent", icon: Icon, className = "", children, ...rest }) {
  return (
    <span className={`ui-chip ui-chip--${tone} ${className}`.trim()} {...rest}>
      {Icon && <Icon size={14} aria-hidden="true" />}
      {children}
    </span>
  );
}
