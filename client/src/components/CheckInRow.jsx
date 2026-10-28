import { LATER_LIMIT } from "../utils/useWorkload";

const shortDay = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// A due check-in as one calm row, at the foot of the week card (or its own small card). Not a modal and
// not a warning: "Later" hides it until tomorrow, but it is counted, and after a few Laters the button goes
// and the row stays until the check-in is taken. One "Start" opens the stress check-in first when both are due.
//
//   pssSince / whoSince     YYYY-MM-DD the check-in became due
//   pssLater / whoLater     how many times "Later" was used in this due cycle
export default function CheckInRow({
  pssDue = false,
  whoDue = false,
  pssSince = "",
  whoSince = "",
  pssLater = 0,
  whoLater = 0,
  onSelectPSS,
  onSelectWHO,
  onLater,
}) {
  if (!pssDue && !whoDue) return null;

  const bothDue = pssDue && whoDue;
  const title = bothDue ? "Two check-ins due" : pssDue ? "Stress check-in due" : "Well-being check-in due";
  const since = bothDue ? [pssSince, whoSince].filter(Boolean).sort()[0] : pssDue ? pssSince : whoSince;
  const canLater = (!pssDue || pssLater < LATER_LIMIT) && (!whoDue || whoLater < LATER_LIMIT);
  const when = since ? `Waiting since ${shortDay(since)}` : "Ready when you are";
  const meta = canLater
    ? `${when} · about 2 minutes`
    : `${when}. It keeps your plan accurate and takes about 2 minutes.`;

  return (
    <div className="checkin-row" role="status" data-tour="dash-checkin">
      <span className="checkin-row-dot" aria-hidden="true" />
      <div className="checkin-row-text">
        <p className="checkin-row-title">{title}</p>
        <p className="checkin-row-meta">{meta}</p>
      </div>
      <div className="checkin-row-actions">
        <button type="button" className="tonal-button" onClick={pssDue ? onSelectPSS : onSelectWHO}>Start</button>
        {canLater && <button type="button" className="ghost-button" onClick={onLater}>Later</button>}
      </div>
    </div>
  );
}
