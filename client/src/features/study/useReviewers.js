import { useCallback, useEffect, useRef, useState } from "react";
import { fetchReviewerStatus, fetchReviewers } from "@/shared/api/reviewers";
import usePolling from "@/shared/hooks/usePolling";

const POLL_MS = 4000;

// The student's reviewers, newest first, once the list has answered.
//   reviewers  null while loading and after a failed load, so the page can leave out what depends on
//              it (the hero, the tab count) instead of blocking
//   settled    true when the first request has finished either way
//   limits     { dailyLimit, usedToday, enabled } from the same answer, or null
//   refresh    fetches again in place (after a create or delete); rows keep their keys
// While any reviewer is still "processing", each such row's /status is checked every 4 seconds
// (paused while the tab is hidden). When one has finished, the list is fetched once more. With
// nothing processing there is no timer at all.
export default function useReviewers() {
  const [state, setState] = useState({ reviewers: null, limits: null, settled: false });
  const live = useRef(true);

  const load = useCallback(async () => {
    const res = await fetchReviewers();
    if (!live.current) return;
    const { reviewers, dailyLimit, usedToday, enabled } = res.data ?? {};
    // A failed refresh keeps what is on screen.
    setState((prev) =>
      res.data
        ? { reviewers: reviewers ?? null, limits: { dailyLimit, usedToday, enabled }, settled: true }
        : { ...prev, settled: true },
    );
  }, []);

  useEffect(() => {
    live.current = true;
    load();
    return () => {
      live.current = false;
    };
  }, [load]);

  const processingIds = (state.reviewers ?? []).filter((r) => r.status === "processing").map((r) => r._id);
  const idsKey = processingIds.join(",");

  usePolling(
    async () => {
      const answers = await Promise.all(processingIds.map(fetchReviewerStatus));
      if (answers.some((a) => a.data && a.data.status !== "processing")) await load();
    },
    POLL_MS,
    { enabled: idsKey !== "" },
  );

  return { ...state, refresh: load };
}
