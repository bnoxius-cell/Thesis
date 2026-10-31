import { useEffect, useState } from "react";
import { fetchSurveyHistory } from "@/shared/api/surveys";

const EMPTY = { pss: [], who: [] };

// The last five results of each check-in, newest first, for the small history lines. The cards read the
// latest result from the account, so a failed load only means the lines stay off.
export default function useCheckInHistory() {
  const [history, setHistory] = useState(EMPTY);

  useEffect(() => {
    let live = true;
    fetchSurveyHistory().then(({ data }) => {
      if (live && data) setHistory({ pss: data.pss, who: data.who });
    });
    return () => {
      live = false;
    };
  }, []);

  return history;
}
