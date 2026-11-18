import { useCallback, useState } from "react";
import { createGroupTask, deleteGroupTask, updateGroupTask } from "@/shared/api/groups";
import { groupTaskPayload } from "./groupTaskForm";

// Adds, changes and removes one group task for the dialog. Each call resolves to a status:
//   "saved"     { task }                the server has it (a delete has no task)
//   "conflict"  { task, conflicts }     someone changed one of those fields first; `task` is theirs
//   "gone"      the task was deleted by someone else
//   "failed"    `error` holds the server's plain message and the dialog stays open
export default function useSaveGroupTask(groupId) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async (request, settle) => {
    setBusy(true);
    setError("");
    const res = await request;
    setBusy(false);
    const settled = settle(res);
    if (settled.status === "failed") setError(res.error);
    return settled;
  }, []);

  const add = useCallback(
    (form) => run(createGroupTask(groupId, groupTaskPayload(form)), (res) => (res.data ? { status: "saved", task: res.data.task } : { status: "failed" })),
    [groupId, run],
  );

  const change = useCallback(
    (taskId, edit) =>
      run(updateGroupTask(groupId, taskId, edit), (res) => {
        if (res.data) return { status: "saved", task: res.data.task };
        if (res.status === 404) return { status: "gone" };
        if (res.status === 409 && res.body?.task) return { status: "conflict", task: res.body.task, conflicts: res.body.conflicts ?? [] };
        return { status: "failed" };
      }),
    [groupId, run],
  );

  // A task that is already gone is as good as deleted.
  const remove = useCallback(
    (taskId) => run(deleteGroupTask(groupId, taskId), (res) => (res.error && res.status !== 404 ? { status: "failed" } : { status: "saved" })),
    [groupId, run],
  );

  return { add, change, remove, busy, error };
}
