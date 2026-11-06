import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { fetchPreferences, saveGroupLevel } from "@/shared/api/notifications";

// What the Info dialog does besides draw. `onChanged` refreshes the group list after a change.
//   level     the student's notification level for this group ("all" | "tasks" | "muted"), null until known
//   changeLevel(next)  saves it; goes back to the old one with a message if the save fails
//   run(call, done)    one admin action (a promise of { error }); `busy` is true while it runs, and a
//                      failure is toasted. Resolves true on success, after refreshing the list.
export default function useGroupInfo(groupId, onChanged) {
  const [level, setLevel] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchPreferences().then(({ data }) => {
      if (!live) return;
      const found = data?.preferences.groupOverrides.find((o) => o.group === groupId);
      setLevel(data ? (found?.level ?? "all") : null);
    });
    return () => {
      live = false;
    };
  }, [groupId]);

  const changeLevel = useCallback(
    async (next) => {
      const before = level;
      setLevel(next);
      const { error } = await saveGroupLevel(groupId, next);
      if (error) {
        setLevel(before);
        toast.error(error);
      }
    },
    [groupId, level],
  );

  const run = useCallback(
    async (call, done) => {
      setBusy(true);
      const { error } = await call();
      if (error) toast.error(error);
      else {
        await onChanged?.();
        if (done) toast.success(done);
      }
      setBusy(false);
      return !error;
    },
    [onChanged],
  );

  return { level, changeLevel, busy, run };
}
