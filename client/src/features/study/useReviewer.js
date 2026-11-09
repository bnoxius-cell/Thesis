import { useCallback, useEffect, useRef, useState } from "react";
import { fetchReviewer, fetchReviewerProgress, fetchReviewerStatus } from "@/shared/api/reviewers";
import usePolling from "@/shared/hooks/usePolling";

const POLL_MS = 4000;
const LOADING = { status: "loading", error: "", reviewer: null, openSession: null, progress: null, making: null };

// One reviewer and how the student is doing on it, in one answer.
async function loadReviewer(id) {
  const [reviewerRes, progressRes] = await Promise.all([fetchReviewer(id), fetchReviewerProgress(id)]);
  if (reviewerRes.error) {
    const missing = reviewerRes.fromApi === true && reviewerRes.status === 404;
    return { ...LOADING, status: missing ? "missing" : "failed", error: reviewerRes.error };
  }
  return {
    status: "loaded",
    error: "",
    reviewer: reviewerRes.data.reviewer,
    openSession: reviewerRes.data.openSession ?? null,
    // Progress is extra: if it fails, the page still opens without it.
    progress: progressRes.data?.progress ?? null,
    making: null,
  };
}

// Everything the Reviewer page shows, for one reviewer id.
//   status      "loading" | "loaded" | "missing" (no such reviewer, or not theirs) | "failed"
//   error       a plain message for the failed state
//   reviewer    the reviewer with its notes (summary, key points, key terms, topics)
//   openSession { _id, mode, answered, total } when a Learning Mode session under 24 hours is open
//   progress    { topics, weakTopics, sessions, lastScore, bestScore }, or null
//   making      { stage, done, total } while it is being made (from the status checks), else null
//   reload      fetches again behind the skeleton (Try again)
// While the reviewer is still "processing", its /status is checked every 4 seconds (paused while
// the tab is hidden), and once it has finished the page is fetched again in place.
export default function useReviewer(id) {
  const [state, setState] = useState(LOADING);
  const [attempt, setAttempt] = useState(0);
  const currentId = useRef(id);

  useEffect(() => {
    currentId.current = id;
    let cancelled = false;
    setState(LOADING);
    loadReviewer(id).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  usePolling(
    async () => {
      const { data } = await fetchReviewerStatus(id);
      if (!data) return;
      if (data.status === "processing") {
        if (currentId.current === id) setState((prev) => (prev.reviewer ? { ...prev, making: data.progress } : prev));
        return;
      }
      const next = await loadReviewer(id);
      if (currentId.current === id && next.status === "loaded") setState(next);
    },
    POLL_MS,
    { enabled: state.reviewer?.status === "processing" },
  );

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
