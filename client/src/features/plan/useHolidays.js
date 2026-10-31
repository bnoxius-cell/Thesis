import { useEffect, useMemo, useRef, useState } from "react";
import { fetchHolidays } from "@/shared/api/schedules";

// Philippine public holidays for the given years, fetched once per year and kept. Turned on only
// when a single timetable is shown (My week gets its holidays from the week overview). A year that
// fails is forgotten, so the next week the student opens tries it again.
//   byDate  { "YYYY-MM-DD": "Holiday name" } for every year loaded so far
//   error   a plain message while the latest lookup failed, otherwise ""
//   pending true while a year is still on its way (and nothing has failed), so the page can wait
export default function useHolidays(years, enabled) {
  const [byYear, setByYear] = useState({});
  const [error, setError] = useState("");
  const asked = useRef(new Set());
  const yearsKey = years.join(",");

  useEffect(() => {
    if (!enabled) return;
    yearsKey.split(",").map(Number).filter((year) => !asked.current.has(year)).forEach(async (year) => {
      asked.current.add(year);
      const { data, error: failure } = await fetchHolidays(year);
      if (failure) {
        asked.current.delete(year);
        setError("Couldn't load public holidays right now.");
        return;
      }
      setError("");
      setByYear((loaded) => ({ ...loaded, [year]: data.holidays }));
    });
  }, [yearsKey, enabled]);

  const byDate = useMemo(
    () => Object.fromEntries(Object.values(byYear).flat().map((holiday) => [holiday.date, holiday.name])),
    [byYear],
  );
  const pending = enabled && !error && years.some((year) => !(year in byYear));
  return { byDate, error, pending };
}
