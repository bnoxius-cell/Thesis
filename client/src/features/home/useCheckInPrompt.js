import { useCallback, useMemo, useState } from "react";
import { nextDueSurvey, nextSnooze } from "@/features/checkin/surveyDue";
import { readSnooze, writeSnooze } from "@/features/checkin/surveySnooze";

// The check-in Home should ask about, if any: { kind: "pss" | "who", canLater } or null, plus later(),
// which hides it until tomorrow and counts the Later.
export default function useCheckInPrompt(userData, now) {
  const [snoozes, setSnoozes] = useState(0);
  const userId = userData?._id;

  // `snoozes` is the only way a saved Later reaches this memo, since storage isn't reactive.
  const prompt = useMemo(
    () => nextDueSurvey(userData, (kind) => readSnooze(userId, kind), now),
    [userData, userId, now, snoozes],
  );

  const later = useCallback(() => {
    if (!prompt) return;
    writeSnooze(userId, prompt.kind, nextSnooze(readSnooze(userId, prompt.kind), prompt.since, new Date()));
    setSnoozes((n) => n + 1);
  }, [prompt, userId]);

  return { prompt, later };
}
