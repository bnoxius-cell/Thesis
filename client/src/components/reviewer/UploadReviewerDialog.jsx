import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { FileUp, FileText, Info, X } from "lucide-react";
import { useAuth } from "../../pages/authentication/AuthContext";
import { QUESTION_COUNTS, DEFAULT_QUESTION_COUNT, MAX_PDF_MB, formatBytes, titleFromFileName, errorMessage } from "./reviewerUtils";

// Pick a PDF, name it, choose how many questions, and send it off. The server reads the text
// and starts writing the reviewer in the background, so this closes as soon as the upload lands.
//
//   onCreated  called with the new reviewer (still "processing")
export default function UploadReviewerDialog({ onClose, onCreated }) {
  const { backendUrl } = useAuth();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT);
  const [courses, setCourses] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  // Suggest course names the student already uses on their tasks.
  useEffect(() => {
    let cancelled = false;
    axios.get(`${backendUrl}/api/tasks`, { withCredentials: true })
      .then(({ data }) => {
        if (cancelled || !data.success) return;
        const names = [...new Set((data.tasks || []).map((t) => t.course?.trim()).filter(Boolean))];
        setCourses(names.sort((a, b) => a.localeCompare(b)).slice(0, 30));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [backendUrl]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const choose = (picked) => {
    setError("");
    if (!picked) return;
    const isPdf = picked.type === "application/pdf" || /\.pdf$/i.test(picked.name);
    if (!isPdf) {
      setError("That isn't a PDF. Pick a .pdf file.");
      return;
    }
    if (picked.size > MAX_PDF_MB * 1024 * 1024) {
      setError(`That PDF is ${formatBytes(picked.size)}. The limit is ${MAX_PDF_MB} MB.`);
      return;
    }
    setFile(picked);
    if (!title.trim() || title === titleFromFileName(file?.name || "")) setTitle(titleFromFileName(picked.name));
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (!busy) choose(e.dataTransfer.files?.[0]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Choose a PDF first.");
      return;
    }
    setBusy(true);
    setError("");
    setProgress(0);
    const form = new FormData();
    form.append("title", title.trim());
    form.append("course", course.trim());
    form.append("questionCount", String(questionCount));
    form.append("pdf", file);
    try {
      const { data } = await axios.post(`${backendUrl}/api/reviewers`, form, {
        withCredentials: true,
        onUploadProgress: (ev) => { if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100)); },
      });
      if (data.success) onCreated(data.reviewer);
      else setError(data.message || "Couldn't upload that PDF.");
    } catch (err) {
      setError(errorMessage(err, "Couldn't upload that PDF. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <form
        className="modal-content reviewer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-reviewer-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="modal-header">
          <h2 id="upload-reviewer-title">New reviewer</h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div
          className={`reviewer-drop${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}`}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            id="reviewer-file"
            type="file"
            accept="application/pdf,.pdf"
            className="visually-hidden"
            onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }}
            disabled={busy}
          />
          {file ? (
            <div className="reviewer-drop-file">
              <FileText size={22} aria-hidden="true" />
              <span>
                <strong>{file.name}</strong>
                <small>{formatBytes(file.size)}</small>
              </span>
              <button type="button" className="secondary-button small" onClick={() => inputRef.current?.click()} disabled={busy}>
                Change
              </button>
            </div>
          ) : (
            <label htmlFor="reviewer-file" className="reviewer-drop-empty">
              <FileUp size={26} aria-hidden="true" />
              <strong>Choose a PDF</strong>
              <span>or drop it here. Lecture notes, handouts and modules work best. Up to {MAX_PDF_MB} MB.</span>
            </label>
          )}
        </div>

        <div className="reviewer-form">
          <label>
            Title
            <input type="text" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Midterm review: Cell biology" disabled={busy} />
          </label>
          <label>
            <span>Course <span className="reviewer-optional">(optional)</span></span>
            <input type="text" value={course} maxLength={80} list="reviewer-courses" onChange={(e) => setCourse(e.target.value)} placeholder="BIO 101" disabled={busy} />
            <datalist id="reviewer-courses">
              {courses.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
          <div className="reviewer-field">
            <span className="reviewer-field-label" id="reviewer-count-label">Practice questions</span>
            <div className="sched-segment" role="group" aria-labelledby="reviewer-count-label">
              {QUESTION_COUNTS.map((n) => (
                <button key={n} type="button" className={questionCount === n ? "active" : ""} aria-pressed={questionCount === n} onClick={() => setQuestionCount(n)} disabled={busy}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="reviewer-notice">
          <Info size={16} aria-hidden="true" />
          <span>
            The text of your PDF goes to Google's Gemini AI to write the reviewer, so leave out anything personal.
            AI can get things wrong. Check anything that looks off against your notes.
          </span>
        </p>

        {error && <p className="reviewer-error" role="alert">{error}</p>}

        <div className="modal-actions reviewer-actions">
          {busy && (
            <span className="reviewer-upload-progress" aria-live="polite">
              {progress < 100 ? `Uploading ${progress}%` : "Reading your PDF..."}
            </span>
          )}
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy || !file}>
            {busy ? "Working..." : "Make reviewer"}
          </button>
        </div>
      </form>
    </div>
  );
}
