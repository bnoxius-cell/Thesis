import { useCallback, useState } from "react";
import { fetchGroups } from "@/shared/api/groups";
import usePolling from "@/shared/hooks/usePolling";

const POLL_MS = 60000;

// The student's groups, refreshed every minute while the tab is in front so a group they were
// removed from or added to shows up without a reload.
//   groups  null until the first answer
//   status  "loading" | "ready" | "failed" (failed only when nothing has loaded yet)
//   reload  tries again after a failure
// A failed refresh keeps the groups already on screen.
export default function useGroups() {
  const [state, setState] = useState({ groups: null, status: "loading", error: "" });

  const load = useCallback(async () => {
    const { data, error } = await fetchGroups();
    setState((prev) => {
      if (data) return { groups: data.groups ?? [], status: "ready", error: "" };
      return prev.groups ? prev : { groups: null, status: "failed", error };
    });
  }, []);

  usePolling(load, POLL_MS);

  const reload = useCallback(() => {
    setState({ groups: null, status: "loading", error: "" });
    load();
  }, [load]);

  return { ...state, reload };
}
