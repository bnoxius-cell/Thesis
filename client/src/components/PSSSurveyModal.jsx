import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { useAuth } from "../pages/authentication/AuthContext";
import "../App.css";

const questions = [
  "been upset because of something that happened unexpectedly?",
  "felt that you were unable to control the important things in your life?",
  "felt nervous and 'stressed'?",
  "felt confident about your ability to handle your personal problems?",
  "felt that things were going your way?",
  "found that you could not cope with all the things that you had to do?",
  "been able to control irritations in your life?",
  "felt that you were on top of things?",
  "been angered because of things that were outside of your control?",
  "felt difficulties were piling up so high that you could not overcome them?",
];

// Reverse scoring for items 4,5,7,8 (indexes 3,4,6,7)
const reverseScored = [3, 4, 6, 7];

const options = [
  { value: 0, label: "Never" },
  { value: 1, label: "Almost Never" },
  { value: 2, label: "Sometimes" },
  { value: 3, label: "Fairly Often" },
  { value: 4, label: "Very Often" },
];

export default function PSSSurveyModal({ isOpen, isFirstTime = false, onClose, onComplete, onRemindLater }) {
  const { backendUrl } = useAuth();
  const [answers, setAnswers] = useState(Array(10).fill(null));
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
    let total = 0;
    for (let i = 0; i < 10; i++) {
      let score = answers[i];
      if (reverseScored.includes(i)) {
        score = 4 - score;
      }
      total += score;
    }
    return total;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (answers.some((a) => a === null)) {
      setError("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const totalScore = calculateScore();
      const { data } = await axios.post(
        `${backendUrl}/api/surveys/pss`,
        { score: totalScore, responses: answers },
        { withCredentials: true }
      );
      if (data.success) {
        setAnswers(Array(10).fill(null));
        setSubmitted(true);
        completeTimeoutRef.current = setTimeout(() => onComplete(totalScore), 1800);
      } else {
        setError(data.message || "Failed to save survey.");
      }
    } catch (err) {
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
      <div className="modal-content pss-modal" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="survey-complete">
            <CheckCircle2 size={40} aria-hidden="true" />
            <h3>Thanks for checking in</h3>
            <p>This helps us keep your plan realistic.</p>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <h2>Stress check-in</h2>
              <button className="modal-close" onClick={onClose}>×</button>
            </div>
            <p className="survey-citation">Perceived Stress Scale (PSS-10), Cohen, Kamarck &amp; Mermelstein, 1983</p>

            <div className="pss-welcome">
              <h3><ClipboardList size={20} aria-hidden="true" /> {isFirstTime ? "Your first check-in" : "Monthly survey time"}</h3>
              <p>
                {isFirstTime
                  ? "It takes about two minutes. Answering honestly helps us build a plan that fits how you're actually doing, not just your deadlines."
                  : "Answer honestly. It helps us organize your schedule and keep you on track with your tasks."}
              </p>
            </div>

            <div className="pss-instructions">
              <p><strong>Instructions:</strong> The questions in this scale ask you about your feelings and thoughts during the <strong>last month</strong>. In each case, you will be asked to indicate how often you felt or thought a certain way.</p>
              <p>For each question, choose the option that best describes your experience.</p>
            </div>

            <div className="survey-progress">
              <div className="survey-progress-track">
                <div className="survey-progress-fill" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
              </div>
              <span>{answeredCount} of {questions.length} answered</span>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="pss-questions">
                {questions.map((q, idx) => (
                  <div key={idx} className="pss-question">
                    <p className="question-text">{idx+1}. In the last month, how often have you… <br /><strong>{q}</strong></p>
                    <div className="pss-options">
                      {options.map((opt) => (
                        <label key={opt.value} className="pss-option">
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
