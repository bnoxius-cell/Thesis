import { useState } from "react";
import axios from "axios";
import { useAuth } from "../pages/authentication/AuthContext";
import "../App.css";

const questions = [
  "I have felt cheerful and in good spirits.",
  "I have felt calm and relaxed.",
  "I have felt active and vigorous.",
  "I woke up feeling fresh and rested.",
  "My daily life has been filled with things that interest me.",
];

const options = [
  { value: 5, label: "All of the time" },
  { value: 4, label: "Most of the time" },
  { value: 3, label: "More than half the time" },
  { value: 2, label: "Less than half the time" },
  { value: 1, label: "Some of the time" },
  { value: 0, label: "At no time" },
];

export default function WHOSurveyModal({ isOpen, onClose, onComplete, onRemindLater }) {
  const { backendUrl } = useAuth();
  const [answers, setAnswers] = useState(Array(5).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleAnswer = (index, value) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const calculateScore = () => {
    const rawTotal = answers.reduce((sum, v) => sum + v, 0);
    return rawTotal * 4; // percentage 0-100
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (answers.some(a => a === null)) {
      setError("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const totalScore = calculateScore();
      const { data } = await axios.post(
        `${backendUrl}/api/surveys/who`,
        { score: totalScore, responses: answers },
        { withCredentials: true }
      );
      if (data.success) {
        setAnswers(Array(5).fill(null));
        onComplete(totalScore);
      } else {
        setError(data.message || "Failed to save survey.");
      }
    } catch (err) {
      console.error("WHO survey error:", err);
      setError(err.response?.data?.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemindLater = () => {
    if (onRemindLater) {
      onRemindLater();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content who-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>WHO-5 Well-Being Index</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="who-welcome">
          <h3>📋 Bi‑weekly survey</h3>
          <p>Please answer the following questions honestly. Your responses help us tailor your workload recommendations.</p>
          <p><strong>Over the last two weeks...</strong></p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="who-questions">
            {questions.map((q, idx) => (
              <div key={idx} className="who-question">
                <p className="question-text">{idx+1}. {q}</p>
                <div className="who-options">
                  {options.map((opt) => (
                    <label key={opt.value} className="who-option">
                      <input
                        type="radio"
                        name={`q${idx}`}
                        value={opt.value}
                        checked={answers[idx] === opt.value}
                        onChange={() => handleAnswer(idx, opt.value)}
                        disabled={submitting}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={handleRemindLater} disabled={submitting}>
              Remind me later (30 min)
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Survey"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
