import { MessageCircle, BarChart3, HeartPulse } from "lucide-react";

// A dismissible, non-blocking banner that nudges the user toward a due
// survey without covering the page like a modal would. Replaces the old
// SurveyPriorityModal, which forced a choice before the user could do
// anything else on first login.
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
    ? "You've got two quick check-ins ready when you are: one about stress, one about how you've been feeling."
    : pssDue
    ? "Your stress check-in is ready whenever you are."
    : "Your well-being check-in is ready whenever you are.";

  return (
    <div className="checkin-banner" role="status">
      <div className="checkin-banner-text">
        <span className="checkin-banner-icon" aria-hidden="true"><MessageCircle size={20} /></span>
        <div>
          <strong>Time for a check-in</strong>
          <p>{message} Take it whenever you're ready, no rush.</p>
        </div>
      </div>
      <div className="checkin-banner-actions">
        {pssDue && (
          <button type="button" className="primary-button small" onClick={onSelectPSS}>
            <BarChart3 size={15} /> Stress check-in
          </button>
        )}
        {whoDue && (
          <button type="button" className="secondary-button small" onClick={onSelectWHO}>
            <HeartPulse size={15} /> Well-being check-in
          </button>
        )}
        <button type="button" className="checkin-banner-dismiss" onClick={onDismiss}>
          Not today
        </button>
      </div>
    </div>
  );
}
