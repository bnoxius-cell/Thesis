import { useCallback, useRef, useState } from "react";
import { fetchReviewers } from "@/shared/api/reviewers";
import { fetchSubjects } from "@/shared/api/subjects";
import { fetchTasks } from "@/shared/api/tasks";
import { buildSearchIndex } from "./searchIndex";

// The header search's data, fetched the first time the student opens the search (not on every page
// load). A list that fails to load is left out; the search only reports a failure when none loaded.
//   status   "idle" | "loading" | "ready" | "failed"
//   entries  what can be found
//   load     starts the fetch; does nothing once it has worked, so it is safe to call on every focus
export default function useSearchIndex() {
  const [state, setState] = useState({ status: "idle", entries: [] });
  const running = useRef(false);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    if (running.current || loaded.current) return;
    running.current = true;
    setState((prev) => ({ ...prev, status: "loading" }));
    const [subjects, reviewers, tasks] = await Promise.all([fetchSubjects(), fetchReviewers(), fetchTasks()]);
    running.current = false;
    if (subjects.error && reviewers.error && tasks.error) {
      setState({ status: "failed", entries: [] });
      return;
    }
    loaded.current = true;
    setState({
      status: "ready",
      entries: buildSearchIndex({
        subjects: subjects.data?.subjects,
        reviewers: reviewers.data?.reviewers,
        tasks: tasks.data?.tasks,
      }),
    });
  }, []);

  return { ...state, load };
}
