import { useEffect, useState } from "react";
import { fetchReviewers } from "@/shared/api/reviewers";

// The student's reviewers, newest first, once the list has answered. `reviewers` is null while it
// loads and after a failed load, so the page can leave out what depends on it (the hero, the tab
// count) instead of blocking. `settled` turns true when the request has finished either way.
export default function useReviewers() {
  const [state, setState] = useState({ reviewers: null, settled: false });

  useEffect(() => {
    let live = true;
    fetchReviewers().then((res) => {
      if (live) setState({ reviewers: res.data?.reviewers ?? null, settled: true });
    });
    return () => {
      live = false;
    };
  }, []);

  return state;
}
