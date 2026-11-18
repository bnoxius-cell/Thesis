import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { fetchGroupPlan, fetchPlanStamp, updateGroupTask } from "@/shared/api/groups";
import { showUndoToast } from "@/features/tasks/doneToast";
import usePolling from "@/shared/hooks/usePolling";

const STAMP_MS = 4000;

const upsert = (tasks, task) => (tasks.some((t) => t._id === task._id) ? tasks.map((t) => (t._id === task._id ? task : t)) : [...tasks, task]);

// One group's plan, kept live. A light "stamp" is polled every 4 seconds while the tab is in front: it says
// when the plan last changed and who else has it open, and the whole plan is read again only when it moved
// past the copy on screen. Mount it with the group id as its `key`.
//   plan         null until the first answer; then { role, tasks, timetable, serverTime, ... }
//   status       "loading" | "ready" | "failed" (failed only while nothing has loaded)
//   presence     [{ userId, editing }]: the other members who have the plan open
//   reload       reads the plan again now
//   applyTask    puts a task the server just answered into the list (a new one is added)
//   dropTask     takes a task out of the list
//   setDone      ticks a task off or back on for the group; resolves to true when it saved
// `editingId` is the task whose dialog is open here (or null): the stamp tells the others, and it is sent at
// once when it changes, so "Ana is editing" doesn't wait for the next poll.
export default function useGroupPlan(groupId, { editingId = null } = {}) {
  const [state, setState] = useState({ plan: null, status: "loading", error: "" });
  const [presence, setPresence] = useState([]);
  const editing = useRef(editingId);
  const loadedAt = useRef(0); // the server clock of the plan on screen: any change after it is news
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    const { data, error } = await fetchGroupPlan(groupId);
    loading.current = false;
    if (data) {
      loadedAt.current = Date.parse(data.serverTime);
      setState({ plan: data, status: "ready", error: "" });
    } else {
      setState((prev) => (prev.plan ? prev : { plan: null, status: "failed", error }));
    }
  }, [groupId]);

  const poll = useCallback(async () => {
    const firstLoad = loadedAt.current === 0 ? load() : null; // a failed first read tries again on the next poll
    const { data } = await fetchPlanStamp(groupId, editing.current);
    if (data) {
      setPresence(data.presence ?? []);
      if (data.planAt && Date.parse(data.planAt) > loadedAt.current) await load();
    }
    await firstLoad;
  }, [groupId, load]);

  usePolling(poll, STAMP_MS);

  const sentEditing = useRef(editingId);
  useEffect(() => {
    editing.current = editingId;
    if (sentEditing.current === editingId) return;
    sentEditing.current = editingId;
    poll();
  }, [editingId, poll]);

  const applyTask = useCallback((task) => {
    setState((prev) => (prev.plan ? { ...prev, plan: { ...prev.plan, tasks: upsert(prev.plan.tasks, task) } } : prev));
  }, []);

  const dropTask = useCallback((taskId) => {
    setState((prev) => (prev.plan ? { ...prev, plan: { ...prev.plan, tasks: prev.plan.tasks.filter((t) => t._id !== taskId) } } : prev));
  }, []);

  // Ticks the task and puts the server's answer in the list; resolves to the saved task, or to null after a
  // plain message when it didn't save (someone else's answer, when they got there first, is shown instead).
  const tick = useCallback(
    async (task, done) => {
      const res = await updateGroupTask(groupId, task._id, { changes: { isCompleted: done }, expected: { isCompleted: task.isCompleted } });
      if (res.data) {
        applyTask(res.data.task);
        return res.data.task;
      }
      if (res.status === 404) dropTask(task._id);
      else if (res.body?.task) applyTask(res.body.task);
      toast.error(res.error);
      return null;
    },
    [groupId, applyTask, dropTask],
  );

  const setDone = useCallback(
    async (task, done) => {
      const saved = await tick(task, done);
      if (!saved) return false;
      if (done) showUndoToast("Marked done for the group.", () => tick(saved, false));
      else toast.success("Reopened.");
      return true;
    },
    [tick],
  );

  return { ...state, presence, reload: load, applyTask, dropTask, setDone };
}
