import { Link } from "react-router-dom";
import { Card } from "@/shared/ui";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// "In this subject" (Figma 76:1103). Notes and files have no tab yet, so only tasks and reviewers;
// each line opens its tab (`tasksTo`, `reviewersTo`).
export default function SubjectCounts({ openTasks, reviewers, tasksTo, reviewersTo }) {
  return (
    <Card as="section" className="subject-card" aria-labelledby="subject-counts-title">
      <h2 id="subject-counts-title" className="subject-card__title">In this subject</h2>
      <Link to={tasksTo} className="subject-card__line subject-card__line--link">{plural(openTasks, "open task")}</Link>
      <Link to={reviewersTo} className="subject-card__line subject-card__line--link">{plural(reviewers, "reviewer")}</Link>
    </Card>
  );
}
