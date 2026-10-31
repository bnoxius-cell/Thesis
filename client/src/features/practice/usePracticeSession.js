import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchReviewer, fetchSession, startSession } from "@/shared/api/reviewers";

const LOADING = { status: "loading", error: "", reviewer: null, session: null };

// Finds the session to run: the open one (under 24 hours, same mode) unless the student asked for a
// fresh start, otherwise a new one. The server owns every rule here; this only picks which call.
async function openSession(reviewerId, mode, fresh) {
  const found = await fetchReviewer(reviewerId);
  if (found.error) {
    const missing = found.fromApi === true && found.status === 404;
    return { ...LOADING, status: missing ? "missing" : "failed", error: found.error };
  }
  const { reviewer, openSession: open } = found.data;
  if (reviewer.status !== "ready") return { ...LOADING, status: "unready", reviewer };

  if (!fresh && open?.mode === mode) {
    const resumed = await fetchSession(reviewerId, open._id);
    if (!resumed.error) return { ...LOADING, status: "loaded", reviewer, session: resumed.data.session };
    // A session that can't be opened any more (new questions arrived) falls through to a new one.
  }
  const started = await startSession(reviewerId, mode);
  if (started.error) return { ...LOADING, status: "failed", error: started.error, reviewer };
  return { ...LOADING, status: "loaded", reviewer, session: started.data.session };
}

// The session behind the Practice page, for one reviewer, mode ("all" | "weak") and `fresh` flag.
//   status    "loading" | "loaded" | "missing" (no such reviewer) | "unready" (still being made, or
//             failed) | "failed" (with `error`, e.g. no weak topics yet)
//   reviewer  the reviewer, once it is known
//   session   the session from the server, with `answers` for the questions already done
//   reload    tries again
// Every navigation to the page (even to the same address, as "Go again" does) opens a session once.
export default function usePracticeSession(reviewerId, mode, fresh) {
  const launch = useLocation().key;
  const [attempt, setAttempt] = useState(0);
  const [done, setDone] = useState({ id: "", result: LOADING });
  const id = `${launch}|${attempt}`;
  // Strict Mode runs the effect twice; the second run shares the first run's request instead of
  // starting a second session.
  const request = useRef({ id: "", promise: null });

  useEffect(() => {
    if (request.current.id !== id) request.current = { id, promise: openSession(reviewerId, mode, fresh) };
    let cancelled = false;
    request.current.promise.then((result) => {
      if (!cancelled) setDone({ id, result });
    });
    return () => {
      cancelled = true;
    };
  }, [id, reviewerId, mode, fresh]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...(done.id === id ? done.result : LOADING), reload };
}
