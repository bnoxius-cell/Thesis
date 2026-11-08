import "./progress-bar.css";

// A thin progress bar. `value` is 0 to 1. It draws in once on mount and eases to new values, both
// with transform only. `label` names it for screen readers; `valueText` says it in words
// ("Question 4 of 10") when a percentage isn't the clearest way. tone: accent | good | watch | danger (an error, such as a failed upload).
// `steady` is for a value that moves in small steps as work happens (bytes sent): it follows each
// step in a straight line instead of easing.
export default function ProgressBar({ value, tone = "accent", steady = false, label, valueText, className = "" }) {
  const clamped = Math.min(1, Math.max(0, Number(value) || 0));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuetext={valueText}
      className={`ui-progress ui-progress--${tone} ${steady ? "ui-progress--steady" : ""} ${className}`.trim()}
    >
      <span className="ui-progress__fill" style={{ "--value": clamped }} />
    </div>
  );
}
