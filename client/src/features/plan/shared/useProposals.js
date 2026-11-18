import { useCallback, useEffect, useState } from "react";
import { fetchProposals } from "@/shared/api/schedules";

// The open proposals on a shared timetable (all of them for its editors, only the student's own for anyone
// else), read once, again when `stamp` changes, and on `reload()`. An empty `scheduleId` reads nothing.
//   const { proposals, reload } = useProposals(scheduleId, stamp);
export default function useProposals(scheduleId, stamp = "") {
  const [loaded, setLoaded] = useState({ scheduleId: "", proposals: [] });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (!scheduleId) return undefined;
    let current = true;
    fetchProposals(scheduleId).then(({ data }) => {
      if (current && data) setLoaded({ scheduleId, proposals: data.proposals });
    });
    return () => {
      current = false;
    };
  }, [scheduleId, stamp, version]);

  return { proposals: loaded.scheduleId === scheduleId ? loaded.proposals : [], reload };
}
