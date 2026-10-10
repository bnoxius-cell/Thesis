import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  ArrowLeft, BookOpenCheck, Ellipsis, FileText, History, Info, LoaderCircle, Pencil, Play, RefreshCw, RotateCcw, Target, Trash2, X,
} from "lucide-react";
import { useAuth } from "../../pages/authentication/AuthContext";
import ConfirmDialog from "../ConfirmDialog";
import Menu, { MenuItem } from "../schedule/Menu";
import LearningMode from "./LearningMode";
import SessionResults from "./SessionResults";
import { QUESTION_COUNTS, LEVEL_LABEL, formatDate, errorMessage } from "./reviewerUtils";

const STATUS_POLL_MS = 3000;

// One reviewer: its notes, the student's progress, and Learning Mode. While the AI is still
// writing it, this shows a waiting state and checks back every few seconds.
export default function ReviewerView({ reviewerId, onBack }) {
  const { backendUrl } = useAuth();
  const api = `${backendUrl}/api/reviewers/${reviewerId}`;

  const [reviewer, setReviewer] = useState(null);
  const [openSession, setOpenSession] = useState(null);
  const [progress, setProgress] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [view, setView] = useState("overview"); // overview | learning | results
  const [session, setSession] = useState(null);
  const [results, setResults] = useState(null);
  const [starting, setStarting] = useState(false);

  const [dialog, setDialog] = useState(null); // rename | regenerate | delete
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [one, prog] = await Promise.all([
        axios.get(api, { withCredentials: true }),
        axios.get(`${api}/progress`, { withCredentials: true }),
      ]);
      if (!one.data.success) {
        setLoadError(one.data.message || "Couldn't open this reviewer.");
        return;
      }
      setReviewer(one.data.reviewer);
      setOpenSession(one.data.openSession);
      if (prog.data.success) {
        setProgress(prog.data.progress);
        setHistory(prog.data.history);
      }
      setLoadError("");
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't open this reviewer. Check your connection and try again."));
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // While the AI is working, check the light status endpoint and reload once it's done.
  const processing = reviewer?.status === "processing";
  useEffect(() => {
    if (!processing) return undefined;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const { data } = await axios.get(`${api}/status`, { withCredentials: true });
        if (data.success && data.status !== "processing") {
          if (data.status === "ready") toast.success("Your reviewer is ready.");
          load();
        }
      } catch { /* try again on the next tick */ }
    }, STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [processing, api, load]);

  const start = async (mode) => {
    setStarting(true);
    try {
      const { data } = await axios.post(`${api}/sessions`, { mode }, { withCredentials: true });
      if (!data.success) {
        toast.error(data.message);
        return;
      }
      setSession(data.session);
      setView("learning");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't start Learning Mode. Try again."));
    } finally {
      setStarting(false);
    }
  };

  const resume = async () => {
    setStarting(true);
    try {
      const { data } = await axios.get(`${api}/sessions/${openSession._id}`, { withCredentials: true });
      if (!data.success) {
        toast.error(data.message);
        return;
      }
      setSession(data.session);
      setView("learning");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't open that session. Start a new one instead."));
      setOpenSession(null);
    } finally {
      setStarting(false);
    }
  };

  const finished = (data) => {
    setSession(null);
    if (data?.session) {
      setResults(data);
      setProgress(data.progress);
      setView("results");
    } else {
      setView("overview");
    }
    load();
  };

  const backToOverview = () => {
    setSession(null);
    setResults(null);
    setView("overview");
    load();
  };

  const remove = async () => {
    setBusy(true);
    try {
      const { data } = await axios.delete(api, { withCredentials: true });
      if (data.success) {
        toast.success("Reviewer deleted.");
        onBack();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete it. Try again."));
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  const regenerate = async (questionCount) => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${api}/regenerate`, { questionCount }, { withCredentials: true });
      if (data.success) {
        setDialog(null);
        setReviewer((r) => ({ ...r, ...data.reviewer }));
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't start that. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const rename = async (fields) => {
    setBusy(true);
    try {
      const { data } = await axios.patch(api, fields, { withCredentials: true });
      if (data.success) {
        setReviewer((r) => ({ ...r, title: data.reviewer.title, course: data.reviewer.course }));
        setDialog(null);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save that. Try again."));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="panel reviewer-message">
        <p>{loadError}</p>
        <button type="button" className="secondary-button" onClick={onBack}>Back to reviewers</button>
      </div>
    );
  }
  if (!reviewer) {
    return <div className="panel reviewer-message"><p>Opening your reviewer...</p></div>;
  }

  if (view === "learning" && session) {
    return (
      <LearningMode
        reviewerId={reviewerId}
        title={reviewer.title}
        session={session}
        onFinished={finished}
        onExit={backToOverview}
      />
    );
  }
  if (view === "results" && results) {
    return (
      <SessionResults
        title={reviewer.title}
        results={results}
        starting={starting}
        onPracticeWeak={() => start("weak")}
        onRestart={() => start("all")}
        onBack={backToOverview}
      />
    );
  }

  const weakCount = progress?.weakTopics?.length || 0;
  const weakQuestions = (progress?.topics || [])
    .filter((t) => t.level === "weak")
    .reduce((sum, t) => sum + t.questionCount, 0);

  const dialogs = (
    <>
      {dialog === "rename" && (
        <RenameDialog reviewer={reviewer} busy={busy} onSave={rename} onClose={() => setDialog(null)} />
      )}
      {dialog === "regenerate" && (
        <RegenerateDialog reviewer={reviewer} busy={busy} onConfirm={regenerate} onClose={() => setDialog(null)} />
      )}
      <ConfirmDialog
        open={dialog === "delete"}
        title="Delete this reviewer?"
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setDialog(null)}
      >
        <p><strong>{reviewer.title}</strong> and your scores on it will be deleted. This can't be undone.</p>
      </ConfirmDialog>
    </>
  );

  const head = (
    <header className="reviewer-head">
      <button type="button" className="reviewer-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> All reviewers
      </button>
      <div className="reviewer-head-row">
        <div>
          <span className="panel-kicker">{reviewer.course || "Reviewer"}</span>
          <h1>{reviewer.title}</h1>
          <p className="reviewer-meta">
            <FileText size={14} aria-hidden="true" />
            {reviewer.source?.fileName || "PDF"}
            {reviewer.source?.pages ? ` · ${reviewer.source.pages} ${reviewer.source.pages === 1 ? "page" : "pages"}` : ""}
            {reviewer.status === "ready" ? ` · ${reviewer.questionCount} questions` : ""}
          </p>
        </div>
        {reviewer.status !== "processing" && (
          <Menu trigger={<><Ellipsis size={18} aria-hidden="true" /> More</>} className="secondary-button small">
            {(close) => (
              <>
                <MenuItem icon={Pencil} onClick={() => { close(); setDialog("rename"); }}>Rename</MenuItem>
                <MenuItem icon={RefreshCw} hint="Write a fresh set from the same PDF" onClick={() => { close(); setDialog("regenerate"); }}>
                  New questions
                </MenuItem>
                <MenuItem icon={Trash2} tone="danger" onClick={() => { close(); setDialog("delete"); }}>Delete</MenuItem>
              </>
            )}
          </Menu>
        )}
      </div>
    </header>
  );

  if (reviewer.status === "processing") {
    return (
      <>
        {head}
        <section className="panel reviewer-waiting" aria-live="polite">
          <LoaderCircle className="reviewer-spin" size={30} aria-hidden="true" />
          <h2>Making your reviewer</h2>
          <p>
            Reading your PDF and writing {reviewer.questionTarget} practice questions. This usually takes under a minute.
            You can leave this page; it keeps going.
          </p>
        </section>
        {dialogs}
      </>
    );
  }

  if (reviewer.status === "failed") {
    return (
      <>
        {head}
        <section className="panel reviewer-waiting is-failed" role="alert">
          <Info size={28} aria-hidden="true" />
          <h2>We couldn't make this reviewer</h2>
          <p>{reviewer.error || "Something went wrong. Try again."}</p>
          <div className="reviewer-button-row">
            <button type="button" className="primary-button" onClick={() => regenerate(reviewer.questionTarget)} disabled={busy}>
              <RotateCcw size={17} aria-hidden="true" /> Try again
            </button>
            <button type="button" className="secondary-button" onClick={() => setDialog("delete")} disabled={busy}>
              Delete
            </button>
          </div>
        </section>
        {dialogs}
      </>
    );
  }

  return (
    <>
      {head}
      {reviewer.source?.truncated && (
        <p className="reviewer-note">
          <Info size={16} aria-hidden="true" /> Your PDF was long, so only the first part was used. For the rest, split it and upload the second half.
        </p>
      )}

      <div className="reviewer-layout">
        <div className="reviewer-side">
          <section className="panel reviewer-practice">
            <span className="panel-kicker"><BookOpenCheck size={15} aria-hidden="true" /> Learning Mode</span>
            <h2>Practice</h2>
            <p>One question at a time. You'll see the answer and why after each one.</p>
            <div className="reviewer-button-col">
              {openSession ? (
                <>
                  <button type="button" className="primary-button" onClick={resume} disabled={starting}>
                    <Play size={17} aria-hidden="true" /> Resume ({openSession.answered} of {openSession.total} done)
                  </button>
                  <button type="button" className="secondary-button" onClick={() => start("all")} disabled={starting}>
                    Start over with all {reviewer.questionCount}
                  </button>
                </>
              ) : (
                <button type="button" className="primary-button" onClick={() => start("all")} disabled={starting}>
                  <Play size={17} aria-hidden="true" /> Start ({reviewer.questionCount} questions)
                </button>
              )}
              {weakCount > 0 && (
                <button type="button" className="secondary-button" onClick={() => start("weak")} disabled={starting}>
                  <Target size={17} aria-hidden="true" /> Practice weak topics ({weakQuestions})
                </button>
              )}
            </div>
          </section>

          <section className="panel reviewer-progress">
            <span className="panel-kicker">How you're doing</span>
            <h2>Topics</h2>
            {progress?.sessions ? (
              <p className="reviewer-progress-sum">
                Last score {progress.lastScore}% · best {progress.bestScore}% · {progress.sessions} {progress.sessions === 1 ? "session" : "sessions"}
              </p>
            ) : (
              <p className="reviewer-progress-sum">Finish a session to see which topics you know and which need more time.</p>
            )}
            <ul className="reviewer-topic-list">
              {(progress?.topics || []).map((t) => (
                <li key={t.name}>
                  <div className="reviewer-topic-row">
                    <span>{t.name}</span>
                    <span className={`reviewer-level is-${t.level}`}>{LEVEL_LABEL[t.level]}</span>
                  </div>
                  <div className="reviewer-bar" aria-hidden="true">
                    <span className={`is-${t.level}`} style={{ width: `${t.accuracy === null ? 0 : Math.round(t.accuracy * 100)}%` }} />
                  </div>
                  <small>
                    {t.answered ? `${t.correct} of ${t.answered} right in recent sessions` : `${t.questionCount} ${t.questionCount === 1 ? "question" : "questions"}`}
                  </small>
                </li>
              ))}
            </ul>
            {history.length > 0 && (
              <details className="reviewer-history">
                <summary><History size={15} aria-hidden="true" /> Past sessions</summary>
                <ul>
                  {history.slice(0, 10).map((h) => (
                    <li key={h._id} className={h.version !== reviewer.version ? "is-old" : ""}>
                      <span>{formatDate(h.finishedAt)}{h.mode === "weak" ? " · weak topics" : ""}{h.version !== reviewer.version ? " · older questions" : ""}</span>
                      <strong>{h.score}%</strong>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>

        <div className="reviewer-main">
          <section className="panel reviewer-notes">
            <span className="panel-kicker">Summary</span>
            <h2>What this covers</h2>
            {reviewer.summary.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          </section>

          {reviewer.keyPoints.length > 0 && (
            <section className="panel reviewer-notes">
              <span className="panel-kicker">Key points</span>
              <h2>Remember these</h2>
              <ul className="reviewer-points">
                {reviewer.keyPoints.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </section>
          )}

          {reviewer.keyTerms.length > 0 && (
            <section className="panel reviewer-notes">
              <span className="panel-kicker">Key terms</span>
              <h2>Terms to know</h2>
              <dl className="reviewer-terms">
                {reviewer.keyTerms.map((t) => (
                  <div key={t.term}>
                    <dt>{t.term}</dt>
                    <dd>{t.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {reviewer.topics.length > 0 && (
            <section className="panel reviewer-notes">
              <span className="panel-kicker">Topics</span>
              <h2>How it breaks down</h2>
              <dl className="reviewer-terms">
                {reviewer.topics.map((t) => (
                  <div key={t.name}>
                    <dt>{t.name}</dt>
                    {t.summary && <dd>{t.summary}</dd>}
                  </div>
                ))}
              </dl>
            </section>
          )}

          <p className="reviewer-ai-note">
            Made by AI from your PDF. It can get things wrong, so check anything that looks off against your notes.
          </p>
        </div>
      </div>
      {dialogs}
    </>
  );
}

function RenameDialog({ reviewer, busy, onSave, onClose }) {
  const [title, setTitle] = useState(reviewer.title);
  const [course, setCourse] = useState(reviewer.course || "");
  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <form
        className="modal-content reviewer-modal is-narrow"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-reviewer-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onSave({ title, course }); }}
      >
        <div className="modal-header">
          <h2 id="rename-reviewer-title">Rename</h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Close"><X size={22} aria-hidden="true" /></button>
        </div>
        <div className="reviewer-form">
          <label>Title<input type="text" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} autoFocus /></label>
          <label><span>Course <span className="reviewer-optional">(optional)</span></span><input type="text" value={course} maxLength={80} onChange={(e) => setCourse(e.target.value)} /></label>
        </div>
        <div className="modal-actions reviewer-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy || !title.trim()}>{busy ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

function RegenerateDialog({ reviewer, busy, onConfirm, onClose }) {
  const [count, setCount] = useState(reviewer.questionTarget || 15);
  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div
        className="modal-content reviewer-modal is-narrow"
        role="dialog"
        aria-modal="true"
        aria-labelledby="regen-reviewer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="regen-reviewer-title">New questions</h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Close"><X size={22} aria-hidden="true" /></button>
        </div>
        <p className="reviewer-dialog-text">
          The AI writes a fresh reviewer and question set from the same PDF. Your past sessions stay in your history,
          but topic progress starts again with the new questions.
        </p>
        <div className="reviewer-field">
          <span className="reviewer-field-label" id="regen-count-label">Practice questions</span>
          <div className="sched-segment" role="group" aria-labelledby="regen-count-label">
            {QUESTION_COUNTS.map((n) => (
              <button key={n} type="button" className={count === n ? "active" : ""} aria-pressed={count === n} onClick={() => setCount(n)} disabled={busy}>{n}</button>
            ))}
          </div>
        </div>
        <div className="modal-actions reviewer-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => onConfirm(count)} disabled={busy}>{busy ? "Starting..." : "Make new questions"}</button>
        </div>
      </div>
    </div>
  );
}
