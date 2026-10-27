import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "../pages/authentication/AuthContext";
import Modal from "./Modal";
import CheckInResult from "./CheckInResult";
import "../App.css";
import BusySpinner from "./BusySpinner";

const LEAVE_PROMPT = { title: "Leave the check-in?", body: "Your answers so far won't be saved.", confirmLabel: "Leave", cancelLabel: "Keep going" };
const ADVANCE_MS = 220;

// One question per screen, for both check-ins. `config` holds what differs (see PSSSurveyModal
// and WHOSurveyModal): the wording, the answers, and where the answers are sent. The score is
// worked out by the server, and the last step shows what it means (CheckInResult).
//
// Steps: -1 is the intro, 0..n-1 the questions, then the result once the answers are saved.
export default function CheckInStepper({ config, isFirstTime = false, onClose, onComplete, onRemindLater }) {
  const { backendUrl, userData } = useAuth();
  const { kind, questions, options } = config;
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState(() => Array(questions.length).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const advanceRef = useRef(null);
  const headingRef = useRef(null);
  // The last result of this check-in before this one, for "better than last time".
  const [previousScore] = useState(() => (kind === "pss" ? userData?.latestPSSScore ?? null : userData?.latestWHOScore ?? null));

  useEffect(() => () => clearTimeout(advanceRef.current), []);
  useEffect(() => { headingRef.current?.focus(); }, [step]);

  const answered = answers.filter((a) => a !== null).length;
  const last = questions.length - 1;
  const onQuestion = step >= 0 && !result;

  const pick = (value, event) => {
    setAnswers((prev) => prev.map((a, i) => (i === step ? value : a)));
    setError("");
    // A tap or click moves on by itself. Keyboard users (event.detail is 0) use Next, so
    // arrowing through the answers doesn't skip ahead.
    clearTimeout(advanceRef.current);
    if (step < last && event.detail > 0) advanceRef.current = setTimeout(() => setStep((s) => s + 1), ADVANCE_MS);
  };

  const go = (to) => {
    clearTimeout(advanceRef.current);
    setStep(to);
  };

  const submit = async () => {
    if (answers.some((a) => a === null)) {
      setError("Please answer every question first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { data } = await axios.post(`${backendUrl}/api/surveys/${kind}`, { responses: answers }, { withCredentials: true });
      if (data.success) setResult({ score: data.score });
      else setError(data.message || "That didn't save. Try again.");
    } catch (err) {
      setError(err.response?.data?.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => onComplete(result.score);
  const notToday = () => (onRemindLater ? onRemindLater() : onClose());
  const question = questions[step];
  const heading = result ? "Your check-in" : config.title;

  return (
    <Modal
      onClose={result ? finish : onClose}
      busy={submitting}
      confirmClose={() => !result && answered > 0}
      leavePrompt={LEAVE_PROMPT}
      className="checkin-modal"
      labelledBy="checkin-title"
    >
      <div className="modal-header">
        <h2 id="checkin-title">{heading}</h2>
        <button type="button" className="modal-close" aria-label="Close" onClick={result ? finish : onClose}>×</button>
      </div>

      {result && <CheckInResult kind={kind} score={result.score} previousScore={previousScore} onDone={finish} />}

      {step === -1 && !result && (
        <div className="checkin-intro">
          <h3 ref={headingRef} tabIndex={-1}>{isFirstTime ? config.introFirst : config.introAgain}</h3>
          <p>{config.introBody}</p>
          <p className="checkin-window"><strong>{config.window}</strong></p>
          <p className="survey-citation">{config.citation}</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={notToday}>Not today</button>
            <button type="button" className="primary-button" onClick={() => go(0)}>Start</button>
          </div>
        </div>
      )}

      {onQuestion && (
        <div className="checkin-step">
          <div className="checkin-progress" aria-live="polite">
            <div className="survey-progress-track" aria-hidden="true">
              <div className="survey-progress-fill" style={{ transform: `scaleX(${(step + 1) / questions.length})` }} />
            </div>
            <span>Question {step + 1} of {questions.length}</span>
          </div>

          <fieldset className="checkin-fieldset" key={step}>
            <legend ref={headingRef} tabIndex={-1} className="checkin-question">
              {config.stem && <span className="checkin-stem">{config.stem}</span>}
              {question}
            </legend>
            <div className="checkin-options">
              {options.map((opt) => (
                <label key={opt.value} className={`checkin-option${answers[step] === opt.value ? " is-selected" : ""}`}>
                  <input
                    type="radio"
                    name={`${kind}-q${step}`}
                    value={opt.value}
                    checked={answers[step] === opt.value}
                    onChange={() => {}}
                    onClick={(event) => pick(opt.value, event)}
                    disabled={submitting}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal-actions checkin-nav">
            <button type="button" className="secondary-button" onClick={() => go(step - 1)} disabled={submitting}>
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
            {step < last ? (
              <button type="button" className="primary-button" onClick={() => go(step + 1)} disabled={answers[step] === null}>
                Next <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="primary-button" onClick={submit} disabled={submitting || answers[step] === null} aria-busy={submitting}>{submitting && <BusySpinner />}
                {submitting ? "Saving..." : "See what changes"}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
