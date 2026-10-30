import "./badge.css";

const CAP = 99;

// A count dot. Renders nothing at 0 or below, and "99+" past the cap. Decorative: the control it
// sits on should say the count in its own label.
export default function Badge({ count, className = "" }) {
  if (!count || count <= 0) return null;
  return (
    <span className={`ui-badge ${className}`.trim()} aria-hidden="true">
      {count > CAP ? `${CAP}+` : count}
    </span>
  );
}
