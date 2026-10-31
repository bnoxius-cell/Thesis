import { useEffect, useRef } from "react";
import { Button } from "@/shared/ui";
import { practiceLink } from "@/features/study/practiceLink";

// The score in a sentence the student can take in, never a verdict.
function scoreLine(score) {
  if (score >= 80) return "Strong work. You know this material well.";
  if (score >= 60) return "Good progress. A little more review will help.";
  return "A good place to start. Go over the topics again, then try once more.";
}

// Topics that still need work, each with how the recent sessions went on it.
function weakRows(progress) {
  const byName = new Map((progress?.topics ?? []).map((t) => [t.name, t]));
  return (progress?.weakTopics ?? []).map((name) => {
    const topic = byName.get(name);
    return { name, note: topic?.answered ? `${topic.correct} of ${topic.answered} right in recent sessions` : "" };
  });
}

// The end of a run (Figma 77:494). The score comes from the server. The weak topics (the same ones
// "Practise these" uses) can be practised again straight away.
export default function PracticeResult({ reviewerId, from, summary }) {
  const { session, progress } = summary;
  const rows = weakRows(progress);
  const heading = useRef(null);
  const again = rows.length > 0
    ? { label: "Practise these again", ...practiceLink(reviewerId, "weak", from, { fresh: true }) }
    : { label: "Go again", ...practiceLink(reviewerId, "all", from, { fresh: true }) };

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="practice-column practice-column--enter">
      <p className="practice-eyebrow">Practice done</p>
      <h1 ref={heading} tabIndex={-1} className="practice-title practice-title--result">
        {session.correct} of {session.answered} right.
      </h1>
      <p className="practice-lead">
        {scoreLine(session.score)}
        {session.answered < session.total && ` You answered ${session.answered} of ${session.total} questions.`}
      </p>
      {rows.length > 0 && (
        <ul className="practice-review" aria-label="Topics to look at again">
          {rows.map((row) => (
            <li key={row.name} className="practice-review__row">
              <span className="practice-review__name">{row.name}</span>
              {row.note && <span className="practice-review__note">{row.note}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="practice-nav practice-nav--result">
        <Button variant="secondary" to={`/study/reviewers/${reviewerId}`} replace>Back to reviewer</Button>
        <Button to={again.to} state={again.state} replace>{again.label}</Button>
      </div>
    </div>
  );
}
