import "./badge.css";

const CAP = 99;

// A count dot. Renders nothing at 0 or below, and "99+" past the cap. `dot` is the plain 8px
// "something new" mark with no number. Decorative: the control it sits on should say what it means
// in its own label.
export default function Badge({ count, dot = false, className = "" }) {
  if (dot) return <span className={`ui-badge ui-badge--dot ${className}`.trim()} aria-hidden="true" />;
  if (!count || count <= 0) return null;
  return (
    <span className={`ui-badge ${className}`.trim()} aria-hidden="true">
      {count > CAP ? `${CAP}+` : count}
    </span>
  );
}
