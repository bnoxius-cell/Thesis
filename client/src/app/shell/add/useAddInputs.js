import { useEffect, useState } from "react";
import { fetchReviewers } from "@/shared/api/reviewers";
import { fetchSubjects } from "@/shared/api/subjects";

// What the dialog for `kind` needs besides what the open page already holds: the subject list (when the page
// holds none) and, for a reviewer, the daily limit. Answers null until the one round of requests has finished,
// so the dialog opens once, ready. A failed request just leaves its part empty: "No subject" still works, and
// the server enforces the limit whatever the dialog shows.
export default function useAddInputs(kind, page) {
  // On a Subject page a task or a reviewer can only go to that subject, so its list is that one subject.
  const pageSubjects = page?.subjects ?? (page?.subject && (kind === "task" || kind === "reviewer") ? [page.subject] : null);
  const needsSubjects = kind !== "subject" && !pageSubjects;
  const needsLimits = kind === "reviewer";
  const [loaded, setLoaded] = useState(needsSubjects || needsLimits ? null : { subjects: [], limits: null });

  useEffect(() => {
    if (loaded) return undefined;
    let live = true;
    Promise.all([needsSubjects && fetchSubjects(), needsLimits && fetchReviewers()]).then(([subjects, reviewers]) => {
      if (!live) return;
      const { dailyLimit, usedToday, enabled } = reviewers?.data ?? {};
      setLoaded({
        subjects: subjects?.data?.subjects ?? [],
        limits: reviewers?.data ? { dailyLimit, usedToday, enabled } : null,
      });
    });
    return () => {
      live = false;
    };
  }, [loaded, needsSubjects, needsLimits]);

  if (!loaded) return null;
  return { subjects: pageSubjects ?? loaded.subjects, limits: loaded.limits };
}
