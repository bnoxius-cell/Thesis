import { useEffect, useState } from "react";
import { fetchTimetable } from "@/shared/api/schedules";

const NONE = { key: "", entries: new Map(), roles: new Map() };

// The classes and the student's role on some timetables, read once (and again when `stamp` changes): what a change
// notice needs to say what moved, and what the details window needs to know whether the student may publish.
//   const { entries, roles } = useTimetableEntries([scheduleId, ...], stamp);
//   entries  Map of entry id -> entry, from all of them
//   roles    Map of timetable id -> "owner" | "editor" | "viewer"
// Empty until they have loaded, and for an empty list (nothing is read).
export default function useTimetableEntries(scheduleIds, stamp = "") {
  const key = [...new Set(scheduleIds)].sort().join(",");
  const [loaded, setLoaded] = useState(NONE);

  useEffect(() => {
    if (!key) return undefined;
    let current = true;
    Promise.all(key.split(",").map(fetchTimetable)).then((answers) => {
      if (!current) return;
      const schedules = answers.flatMap(({ data }) => (data ? [data.schedule] : []));
      setLoaded({
        key,
        entries: new Map(schedules.flatMap((schedule) => schedule.entries.map((entry) => [entry._id, entry]))),
        roles: new Map(schedules.map((schedule) => [schedule._id, schedule.role])),
      });
    });
    return () => {
      current = false;
    };
  }, [key, stamp]);

  return loaded.key === key ? loaded : NONE;
}
