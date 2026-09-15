import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ClipboardList, CheckCircle2 } from "lucide-react";
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

export default function WHOSurveyModal({ isOpen, isFirstTime = false, onClose, onComplete, onRemindLater }) {
  const { backendUrl } = useAuth();
  const [answers, setAnswers] = useState(Array(5).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const completeTimeoutRef = useRef(null);

  // Dashboard only mounts this component while it's open, so state already
  // starts fresh each time. Just make sure a pending "show the thank-you,
  // then close" timer never fires after the modal has been torn down.
  useEffect(() => () => {
    if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
  }, []);

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
        setSubmitted(true);
        completeTimeoutRef.current = setTimeout(() => onComplete(totalScore), 1800);
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

  const answeredCount = answers.filter((a) => a !== null).length;

  return (
    <div className="modal-overlay" onClick={submitted ? undefined : onClose}>
      <div className="modal-content who-modal" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="survey-complete">
            <CheckCircle2 size={40} aria-hidden="true" />
            <h3>Thanks for checking in</h3>
            <p>This helps us keep your plan realistic.</p>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <h2>Well-being check-in</h2>
              <button className="modal-close" onClick={onClose}>×</button>
            </div>
            <p className="survey-citation">WHO-5 Well-Being Index, World Health Organization, 1998</p>

            <div className="who-welcome">
              <h3><ClipboardList size={20} aria-hidden="true" /> {isFirstTime ? "Your first check-in" : "Bi‑weekly survey"}</h3>
              <p>
                {isFirstTime
                  ? "A few quick questions about the last two weeks, so we can understand more than just your task list."
                  : "Answer honestly. Your responses help us tailor your workload recommendations."}
              </p>
              <p><strong>Over the last two weeks...</strong></p>
            </div>

            <div className="survey-progress">
              <div className="survey-progress-track">
                <div className="survey-progress-fill" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
              </div>
              <span>{answeredCount} of {questions.length} answered</span>
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
                  Not today
                </button>
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Survey"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
