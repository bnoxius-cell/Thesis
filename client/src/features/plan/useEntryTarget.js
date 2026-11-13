import { useEffect, useState } from "react";
import { fetchMainTimetable } from "@/shared/api/schedules";

// The timetable a new entry lands on, for the form's subtitle, shared line and clash note. A picked
// timetable is passed in. Without one the student's main timetable is read (null when they have none yet,
// undefined while it loads).
export default function useEntryTarget(picked) {
  const [main, setMain] = useState(undefined);

  useEffect(() => {
    if (picked) return undefined;
    let cancelled = false;
    fetchMainTimetable().then(({ data }) => {
      if (!cancelled) setMain(data?.schedule ?? null);
    });
    return () => { cancelled = true; };
  }, [picked]);

  return picked ?? main;
}
