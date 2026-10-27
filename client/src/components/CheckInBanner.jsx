import { MessageCircle } from "lucide-react";

// A slim, dismissible nudge toward a due check-in. Not a modal, so it never stops the student from
// using the page. One "Start" button opens the stress check-in first when both are due; the
// well-being one follows once that is done.
export default function CheckInBanner({
  isOpen,
  onSelectPSS,
  onSelectWHO,
  onDismiss,
  pssDue = false,
  whoDue = false,
}) {
  if (!isOpen || (!pssDue && !whoDue)) return null;

  const bothDue = pssDue && whoDue;
  const message = bothDue
    ? "Two quick check-ins are ready, one on stress and one on how you've been feeling."
    : pssDue
    ? "Your stress check-in is ready when you are."
    : "Your well-being check-in is ready when you are.";

  return (
    <div className="notice is-info checkin-notice" role="status" data-tour="dash-checkin">
      <MessageCircle size={16} aria-hidden="true" />
      <div className="checkin-notice-body">
        <p><strong>Time for a check-in.</strong> {message}</p>
        <div className="checkin-notice-actions">
          <button type="button" className="tonal-button" onClick={pssDue ? onSelectPSS : onSelectWHO}>Start</button>
          <button type="button" className="ghost-button" onClick={onDismiss}>Not today</button>
        </div>
      </div>
    </div>
  );
}
