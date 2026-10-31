import { Card } from "@/shared/ui";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// "In this subject" (Figma 76:1103). Notes and files have no backend yet, so only tasks and reviewers.
export default function SubjectCounts({ openTasks, reviewers }) {
  return (
    <Card as="section" className="subject-card" aria-labelledby="subject-counts-title">
      <h2 id="subject-counts-title" className="subject-card__title">In this subject</h2>
      <p className="subject-card__line">{plural(openTasks, "open task")}</p>
      <p className="subject-card__line">{plural(reviewers, "reviewer")}</p>
    </Card>
  );
}
