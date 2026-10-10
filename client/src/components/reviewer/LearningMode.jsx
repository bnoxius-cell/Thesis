import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Check, X, ArrowRight } from "lucide-react";
import { useAuth } from "../../pages/authentication/AuthContext";
import ConfirmDialog from "../ConfirmDialog";
import { LETTERS, errorMessage } from "./reviewerUtils";

// One question at a time. The server grades each answer and only then sends the right answer
// and the explanation back, so nothing here knows the key in advance. Keys 1-4 (or A-D) pick
// an answer, Enter goes on.
//
//   session     { _id, questions, answers } from the server (answers lets a session resume)
//   onFinished  called with the finish response ({ session, review, progress } or session null)
//   onExit      back to the reviewer without finishing
export default function LearningMode({ reviewerId, title, session, onFinished, onExit }) {
  const { backendUrl } = useAuth();
  const base = `${backendUrl}/api/reviewers/${reviewerId}/sessions/${session._id}`;
  const { questions } = session;

  const [results, setResults] = useState(() => new Map(session.answers.map((a) => [String(a.questionId), a])));
  const [index, setIndex] = useState(() => {
    const answered = new Set(session.answers.map((a) => String(a.questionId)));
    const next = questions.findIndex((q) => !answered.has(String(q._id)));
    return next === -1 ? questions.length - 1 : next;
  });
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const headingRef = useRef(null);
  const nextRef = useRef(null);

  const question = questions[index];
  const result = question ? results.get(String(question._id)) : null;
  const answeredCount = results.size;
  const isLast = index === questions.length - 1;
  const correctSoFar = [...results.values()].filter((r) => r.correct).length;

  useEffect(() => { headingRef.current?.focus(); }, [index]);
  useEffect(() => { if (result) nextRef.current?.focus(); }, [result]);

  const finish = useCallback(async () => {
    setFinishing(true);
    try {
      const { data } = await axios.post(`${base}/finish`, {}, { withCredentials: true });
      if (data.success) onFinished(data);
      else toast.error(data.message);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save your session. Check your connection and try again."));
    } finally {
      setFinishing(false);
      setConfirmEnd(false);
    }
  }, [base, onFinished]);

  const answer = useCallback(async (choice) => {
    if (!question || result || sending) return;
    setSending(true);
    try {
      const { data } = await axios.post(`${base}/answer`, { questionId: question._id, choice }, { withCredentials: true });
      if (data.success) {
        setResults((prev) => new Map(prev).set(String(question._id), data.result));
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send your answer. Check your connection and try again."));
    } finally {
      setSending(false);
    }
  }, [base, question, result, sending]);

  const next = useCallback(() => {
    if (!result) return;
    if (isLast) finish();
    else setIndex((i) => i + 1);
  }, [result, isLast, finish]);

  useEffect(() => {
    const onKey = (e) => {
      if (confirmEnd || e.altKey || e.ctrlKey || e.metaKey) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const pick = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 }[e.key.toLowerCase()];
      if (pick !== undefined && !result) {
        e.preventDefault();
        answer(pick);
      } else if (e.key === "Enter" && result && e.target.tagName !== "BUTTON") {
        e.preventDefault();
        next();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [answer, next, result, confirmEnd]);

  if (!question) {
    return (
      <div className="panel reviewer-message">
        <p>This session has no questions left.</p>
        <button type="button" className="secondary-button" onClick={onExit}>Back to the reviewer</button>
      </div>
    );
  }

  const optionState = (i) => {
    if (!result) return "";
    if (i === result.correctIndex) return " is-correct";
    if (i === result.choice) return " is-wrong";
    return " is-dim";
  };

  return (
    <section className="reviewer-learning" aria-label={`Learning Mode: ${title}`}>
      <div className="learning-top">
        <div className="learning-count">
          <span>Question {index + 1} of {questions.length}</span>
          <small>{correctSoFar} right so far</small>
        </div>
        <button type="button" className="secondary-button small" onClick={() => (answeredCount ? setConfirmEnd(true) : onExit())} disabled={finishing}>
          {answeredCount ? "End session" : "Leave"}
        </button>
      </div>
      <div
        className="learning-progress"
        role="progressbar"
        aria-label="Questions answered"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={answeredCount}
      >
        <span style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
      </div>

      <article className="panel learning-card" key={question._id}>
        <div className="learning-tags">
          <span className="learning-topic">{question.topic}</span>
          <span className="learning-difficulty">{question.difficulty}</span>
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="learning-prompt">{question.prompt}</h2>

        <div className="learning-options" role="group" aria-label="Answers">
          {question.options.map((option, i) => (
            <button
              key={i}
              type="button"
              className={`learning-option${optionState(i)}`}
              onClick={() => answer(i)}
              disabled={Boolean(result) || sending}
              aria-pressed={result ? result.choice === i : undefined}
            >
              <span className="learning-letter" aria-hidden="true">
                {result && i === result.correctIndex ? <Check size={16} /> : result && i === result.choice ? <X size={16} /> : LETTERS[i]}
              </span>
              <span className="learning-option-text">{option}</span>
              {result && i === result.correctIndex && <span className="visually-hidden">(correct answer)</span>}
              {result && i === result.choice && i !== result.correctIndex && <span className="visually-hidden">(your answer)</span>}
            </button>
          ))}
        </div>

        {result && (
          <div className={`learning-feedback${result.correct ? " is-correct" : " is-wrong"}`} role="status">
            <strong>{result.correct ? "Correct." : `Not quite. The answer is ${LETTERS[result.correctIndex]}.`}</strong>
            {result.explanation && <p>{result.explanation}</p>}
          </div>
        )}

        <div className="learning-actions">
          {!result && <span className="learning-hint">Pick an answer, or press 1 to 4.</span>}
          {result && (
            <button ref={nextRef} type="button" className="primary-button" onClick={next} disabled={finishing}>
              {isLast ? (finishing ? "Saving..." : "See results") : <>Next <ArrowRight size={17} aria-hidden="true" /></>}
            </button>
          )}
        </div>
      </article>

      <ConfirmDialog
        open={confirmEnd}
        title="End this session?"
        confirmLabel="End and see results"
        cancelLabel="Keep going"
        busy={finishing}
        onConfirm={finish}
        onCancel={() => setConfirmEnd(false)}
      >
        <p>You've answered {answeredCount} of {questions.length}. Your score counts the ones you answered.</p>
      </ConfirmDialog>
    </section>
  );
}
