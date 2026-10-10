import { useState } from "react";
import { ArrowLeft, Check, RotateCcw, Sparkles, Target, X } from "lucide-react";
import { LETTERS, LEVEL_LABEL, scoreMessage } from "./reviewerUtils";

const MODE_KICKER = { all: "Session done", weak: "Weak topics", targeted: "New questions" };

// After a session: the score, how each topic went, which topics to review overall, and every
// question with the right answer and why. Scores come from the server, never from this page.
export default function SessionResults({ title, results, starting, onPracticeWeak, onMoreQuestions, onRestart, onBack }) {
  const { session, review, progress } = results;
  const missed = review.filter((r) => !r.correct);
  const [onlyMissed, setOnlyMissed] = useState(missed.length > 0);
  const shown = onlyMissed ? missed : review;
  const weakTopics = progress?.weakTopics || [];

  return (
    <div className="reviewer-results">
      <button type="button" className="reviewer-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> {title}
      </button>

      <section className="panel results-score">
        <div className="results-ring" style={{ "--score": session.score ?? 0 }} aria-hidden="true">
          <span>{session.score ?? 0}%</span>
        </div>
        <div>
          <span className="panel-kicker">{MODE_KICKER[session.mode] || MODE_KICKER.all}</span>
          <h1>{session.correct} of {session.answered} right</h1>
          <p>{scoreMessage(session.score)}</p>
          {session.answered < session.total && (
            <p className="results-sub">You answered {session.answered} of {session.total} questions.</p>
          )}
          <div className="reviewer-button-row">
            {weakTopics.length > 0 && (
              <>
                <button type="button" className="primary-button" onClick={onPracticeWeak} disabled={starting}>
                  <Target size={17} aria-hidden="true" /> Practice weak topics
                </button>
                <button type="button" className="secondary-button" onClick={onMoreQuestions} disabled={starting}>
                  <Sparkles size={17} aria-hidden="true" /> New questions on them
                </button>
              </>
            )}
            <button type="button" className={weakTopics.length ? "secondary-button" : "primary-button"} onClick={onRestart} disabled={starting}>
              <RotateCcw size={17} aria-hidden="true" /> Go again
            </button>
            <button type="button" className="secondary-button" onClick={onBack}>Back to the reviewer</button>
          </div>
        </div>
      </section>

      <div className="reviewer-layout">
        <div className="reviewer-side">
          <section className="panel reviewer-progress">
            <span className="panel-kicker">This session</span>
            <h2>By topic</h2>
            <ul className="reviewer-topic-list">
              {(session.topicStats || []).map((t) => {
                const pct = t.total ? Math.round((t.correct / t.total) * 100) : 0;
                return (
                  <li key={t.topic}>
                    <div className="reviewer-topic-row">
                      <span>{t.topic}</span>
                      <span>{t.correct} of {t.total}</span>
                    </div>
                    <div className="reviewer-bar" aria-hidden="true">
                      <span className={pct >= 80 ? "is-strong" : pct >= 60 ? "is-fair" : "is-weak"} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {progress?.topics?.length > 0 && (
            <section className="panel reviewer-progress">
              <span className="panel-kicker">Across your recent sessions</span>
              <h2>Where you stand</h2>
              <ul className="reviewer-level-list">
                {progress.topics.map((t) => (
                  <li key={t.name}>
                    <span>{t.name}</span>
                    <span className={`reviewer-level is-${t.level}`}>{LEVEL_LABEL[t.level]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="panel reviewer-main results-review">
          <div className="results-review-head">
            <div>
              <span className="panel-kicker">Review</span>
              <h2>{onlyMissed ? "What you missed" : "All your answers"}</h2>
            </div>
            {missed.length > 0 && missed.length < review.length && (
              <div className="sched-segment" role="group" aria-label="Show">
                <button type="button" className={onlyMissed ? "active" : ""} aria-pressed={onlyMissed} onClick={() => setOnlyMissed(true)}>Missed ({missed.length})</button>
                <button type="button" className={!onlyMissed ? "active" : ""} aria-pressed={!onlyMissed} onClick={() => setOnlyMissed(false)}>All ({review.length})</button>
              </div>
            )}
          </div>
          {missed.length === 0 && <p className="results-sub">You got every question you answered right.</p>}
          <ol className="results-list">
            {shown.map((r) => (
              <li key={r._id} className={r.correct ? "is-correct" : "is-wrong"}>
                <span className="results-topic">{r.topic}</span>
                <p className="results-prompt">{r.prompt}</p>
                <p className="results-answer">
                  {r.correct ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                  <span>
                    {r.correct ? "You answered " : "You picked "}
                    <strong>{LETTERS[r.choice]}. {r.options[r.choice]}</strong>
                  </span>
                </p>
                {!r.correct && (
                  <p className="results-answer is-key">
                    <Check size={16} aria-hidden="true" />
                    <span>Answer: <strong>{LETTERS[r.correctIndex]}. {r.options[r.correctIndex]}</strong></span>
                  </p>
                )}
                {r.explanation && <p className="results-why">{r.explanation}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
