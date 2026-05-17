import { useState } from "react";
import axios from "axios";
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

export default function PSSSurveyModal({ isOpen, onClose, onComplete, onRemindLater }) {
  const { backendUrl } = useAuth();
  const [answers, setAnswers] = useState(Array(10).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
        onComplete(totalScore);
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content pss-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Perceived Stress Scale (PSS-10)</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="pss-welcome">
          <h3>📋 Monthly survey time!</h3>
          <p>Kindly answer the survey honestly so that we can better organize your schedule and help you keep on track with your tasks.</p>
        </div>

        <div className="pss-instructions">
          <p><strong>Instructions:</strong> The questions in this scale ask you about your feelings and thoughts during the <strong>last month</strong>. In each case, you will be asked to indicate how often you felt or thought a certain way.</p>
          <p>For each question, choose the option that best describes your experience.</p>
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
