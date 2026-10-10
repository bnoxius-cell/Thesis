import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { BookOpenCheck, FileText, FileUp, LoaderCircle, Info } from "lucide-react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import UploadReviewerDialog from "../components/reviewer/UploadReviewerDialog";
import ReviewerView from "../components/reviewer/ReviewerView";
import { formatDate } from "../components/reviewer/reviewerUtils";
import { useAuth } from "./authentication/AuthContext";
import "../App.css";

const LIST_POLL_MS = 4000;

// Reviewers made from the student's own PDFs. The list lives here; `?r=<id>` opens one
// (notes, progress and Learning Mode), the same way Groups opens a chat with `?g=`.
export default function Reviewers() {
  const { backendUrl } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get("r");

  const [data, setData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const { data: res } = await axios.get(`${backendUrl}/api/reviewers`, { withCredentials: true });
      if (res.success) {
        setData(res);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch {
      setLoadFailed(true);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (!openId) fetchList();
  }, [fetchList, openId]);

  // Keep the cards current while any reviewer is still being made.
  const anyProcessing = data?.reviewers.some((r) => r.status === "processing");
  useEffect(() => {
    if (!anyProcessing || openId) return undefined;
    const timer = setInterval(() => { if (!document.hidden) fetchList(); }, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [anyProcessing, fetchList, openId]);

  const open = (id) => setSearchParams({ r: id });
  const close = () => setSearchParams({});

  if (openId) {
    return (
      <div className="app app-layout">
        <Header />
        <main className="dashboard reviewer-page">
          <ReviewerView key={openId} reviewerId={openId} onBack={close} />
        </main>
        <Footer />
      </div>
    );
  }

  const left = data ? Math.max(0, data.dailyLimit - data.usedToday) : null;
  const canUpload = data?.enabled && left > 0;

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard reviewer-page">
        <section className="reviewer-intro">
          <div>
            <span className="panel-kicker"><BookOpenCheck size={15} aria-hidden="true" /> Study</span>
            <h1>Reviewers</h1>
            <p>
              Upload your notes, a handout or a module as a PDF. You'll get a short reviewer, key terms and practice
              questions, and you'll see which topics need more of your time.
            </p>
          </div>
          <div className="reviewer-intro-actions">
            <button type="button" className="primary-button" onClick={() => setUploadOpen(true)} disabled={!canUpload}>
              <FileUp size={18} aria-hidden="true" /> Upload a PDF
            </button>
            {data?.enabled && left !== null && left <= 3 && (
              <small>{left === 0 ? "You've reached today's limit. You can make more tomorrow." : `You can make ${left} more today.`}</small>
            )}
          </div>
        </section>

        {data && !data.enabled && (
          <p className="reviewer-note" role="status">
            <Info size={16} aria-hidden="true" /> Reviewers aren't set up on this server yet, so new uploads are off for now.
          </p>
        )}

        {!data && !loadFailed && <div className="panel reviewer-message"><p>Loading your reviewers...</p></div>}
        {loadFailed && !data && (
          <div className="panel reviewer-message">
            <p>Couldn't load your reviewers. Check your connection and try again.</p>
            <button type="button" className="secondary-button" onClick={fetchList}>Try again</button>
          </div>
        )}

        {data && data.reviewers.length === 0 && (
          <section className="panel reviewer-empty">
            <BookOpenCheck size={30} aria-hidden="true" />
            <h2>No reviewers yet</h2>
            <p>Start with the notes for your next quiz or exam. It takes about a minute.</p>
            {canUpload && (
              <button type="button" className="primary-button" onClick={() => setUploadOpen(true)}>
                <FileUp size={18} aria-hidden="true" /> Upload a PDF
              </button>
            )}
          </section>
        )}

        {data && data.reviewers.length > 0 && (
          <ul className="reviewer-grid">
            {data.reviewers.map((r) => (
              <li key={r._id}>
                <button type="button" className={`reviewer-card is-${r.status}`} onClick={() => open(r._id)}>
                  <span className="reviewer-card-icon" aria-hidden="true">
                    {r.status === "processing" ? <LoaderCircle className="reviewer-spin" size={20} /> : <FileText size={20} />}
                  </span>
                  <span className="reviewer-card-body">
                    {r.course && <span className="reviewer-card-course">{r.course}</span>}
                    <strong>{r.title}</strong>
                    <span className="reviewer-card-meta">
                      {r.status === "processing" && "Making it now..."}
                      {r.status === "failed" && "Couldn't make this one. Open it to try again."}
                      {r.status === "ready" && `${r.questionCount} questions · ${r.topicCount} topics`}
                    </span>
                  </span>
                  {r.status === "ready" && (
                    <span className="reviewer-card-score">
                      {r.lastScore === null ? (
                        <small>Not practised yet</small>
                      ) : (
                        <>
                          <strong>{r.lastScore}%</strong>
                          <small>Last session, {formatDate(r.lastStudiedAt)}</small>
                        </>
                      )}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      {uploadOpen && (
        <UploadReviewerDialog
          onClose={() => setUploadOpen(false)}
          onCreated={(reviewer) => {
            setUploadOpen(false);
            open(reviewer._id);
          }}
        />
      )}
      <Footer />
    </div>
  );
}
