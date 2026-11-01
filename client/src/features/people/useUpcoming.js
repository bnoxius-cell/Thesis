import { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { fetchUpcoming } from "@/shared/api/groups";
import { importSharedTask } from "@/shared/api/tasks";
import usePolling from "@/shared/hooks/usePolling";

const POLL_MS = 60000;

// One group's shared deadlines, refreshed every minute while the tab is in front.
//   deadlines  null until the first answer (a failed refresh keeps the last list)
//   status     "loading" | "ready" | "failed" (failed only when nothing has loaded yet)
//   addingId   the deadline being added right now, if any
//   add        add(deadline) puts a copy in the student's own tasks; a toast says why if it fails
//   retry      tries the first load again
// A deadline the student just added counts as added at once, even if a refresh that was already on
// its way still says otherwise.
export default function useUpcoming(groupId) {
  const [state, setState] = useState({ deadlines: null, status: "loading", error: "" });
  const [added, setAdded] = useState(() => new Set());
  const [addingId, setAddingId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await fetchUpcoming(groupId);
    setState((prev) => {
      if (data) return { deadlines: data.deadlines ?? [], status: "ready", error: "" };
      return prev.deadlines ? prev : { deadlines: null, status: "failed", error };
    });
  }, [groupId]);

  usePolling(load, POLL_MS);

  const retry = useCallback(() => {
    setState({ deadlines: null, status: "loading", error: "" });
    load();
  }, [load]);

  const add = useCallback(async (deadline) => {
    setAddingId(deadline._id);
    const res = await importSharedTask(deadline.task.shareTag);
    setAddingId(null);
    if (res.data) toast.success("Added to your plan.");
    // 409 means the task is already theirs, which is the state they asked for.
    else if (res.status !== 409) return toast.error(res.error);
    setAdded((prev) => new Set(prev).add(deadline._id));
  }, []);

  const deadlines = useMemo(
    () => state.deadlines?.map((d) => (added.has(d._id) ? { ...d, addedByMe: true } : d)) ?? null,
    [state.deadlines, added],
  );

  return { deadlines, status: state.status, error: state.error, addingId, add, retry };
}
