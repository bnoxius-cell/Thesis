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
    ? "You have both a monthly stress check-in and a bi-weekly well-being check-in due."
    : pssDue
    ? "Your monthly stress check-in (PSS-10) is due."
    : "Your bi-weekly well-being check-in (WHO-5) is due.";

  return (
    <div className="checkin-banner" role="status">
      <div className="checkin-banner-text">
        <span className="checkin-banner-icon" aria-hidden="true">💬</span>
        <div>
          <strong>Time for a check-in</strong>
          <p>{message} Take it whenever you're ready — no rush.</p>
        </div>
      </div>
      <div className="checkin-banner-actions">
        {pssDue && (
          <button type="button" className="primary-button small" onClick={onSelectPSS}>
            📊 PSS-10
          </button>
        )}
        {whoDue && (
          <button type="button" className="secondary-button small" onClick={onSelectWHO}>
            💚 WHO-5
          </button>
        )}
        <button type="button" className="checkin-banner-dismiss" onClick={onDismiss} aria-label="Dismiss, remind me later">
          ×
        </button>
      </div>
    </div>
  );
}
