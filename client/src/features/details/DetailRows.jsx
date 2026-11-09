import "./item-detail.css";

// The facts in the details window (Figma DetailRow 203:6): a hairline, a 20px icon, a muted label and the
// value. A row with nothing to show is left out, so callers pass what they have and the rest disappears.
export function DetailRows({ children }) {
  return <dl className="detail-rows">{children}</dl>;
}

// `muted` greys the value (for "No subject"). `split` puts a trailing control (the Join button) at the right.
export function DetailRow({ icon, label, muted = false, split = false, children }) {
  if (children == null || children === false || children === "") return null;
  const Icon = icon;
  return (
    <div className={`detail-row${split ? " detail-row--split" : ""}`}>
      <dt className="detail-row__term">
        <Icon size={20} aria-hidden="true" />
        <span>{label}</span>
      </dt>
      <dd className={`detail-row__value${muted ? " is-muted" : ""}`}>{children}</dd>
    </div>
  );
}
