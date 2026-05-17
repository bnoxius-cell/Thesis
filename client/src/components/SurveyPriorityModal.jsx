export default function SurveyPriorityModal({ 
  isOpen,
  onSelectPSS, 
  onSelectWHO, 
  onRemindLater,
  pssCompleted = false,
  whoCompleted = false
}) {
  if (!isOpen) return null;

  const bothRemaining = !pssCompleted && !whoCompleted;
  const pssRemaining = !pssCompleted && whoCompleted;
  const whoRemaining = pssCompleted && !whoCompleted;

  let title = "Time for your check‑in";
  let message = "";

  if (bothRemaining) {
    message = "You have both monthly and bi‑weekly surveys due. Which one would you like to take first?";
  } else if (pssRemaining) {
    message = "✅ Your bi‑weekly well‑being survey is complete. Please complete the monthly stress survey.";
  } else if (whoRemaining) {
    message = "✅ Your monthly stress survey is complete. Please complete the bi‑weekly well‑being survey.";
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content survey-priority-modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onRemindLater}>×</button>
        </div>
        <div className="priority-content">
          <p>{message}</p>
          <div className="priority-buttons">
            {bothRemaining ? (
              <>
                <button className="primary-button" onClick={onSelectPSS}>📊 PSS-10 (Stress)</button>
                <button className="secondary-button" onClick={onSelectWHO}>💚 WHO-5 (Well‑being)</button>
              </>
            ) : pssRemaining ? (
              <button className="primary-button" onClick={onSelectPSS}>📊 PSS-10 (Stress) – Remaining</button>
            ) : whoRemaining ? (
              <button className="primary-button" onClick={onSelectWHO}>💚 WHO-5 (Well‑being) – Remaining</button>
            ) : null}
          </div>
          <button className="ghost-button" onClick={onRemindLater}>Remind me later (30 min)</button>
        </div>
      </div>
    </div>
  );
}
