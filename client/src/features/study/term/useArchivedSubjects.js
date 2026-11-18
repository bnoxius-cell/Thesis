import { useCallback, useEffect, useState } from "react";
import { fetchArchivedSubjects } from "@/shared/api/subjects";

// The student's archived subjects (Study > Subjects > Archived).
//   status    "loading" | "ready" | "failed"
//   error     a plain message for the failed state
//   subjects  the archived subjects, each with the class times kept on it (`pastClassTimes`) and its counts
//   reload    fetches again behind the loading state (Try again)
//   refresh   fetches again in place (after an archive, a restore or a new term); a failed fetch keeps the list
export default function useArchivedSubjects() {
  const [state, setState] = useState({ status: "loading", error: "", subjects: [] });

  const load = useCallback(async (quiet = false) => {
    const { data, error } = await fetchArchivedSubjects();
    if (error) {
      if (!quiet) setState({ status: "failed", error, subjects: [] });
      return;
    }
    setState({ status: "ready", error: "", subjects: data.subjects });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, status: "loading" }));
    return load();
  }, [load]);
  const refresh = useCallback(() => load(true), [load]);

  return { ...state, reload, refresh };
}
