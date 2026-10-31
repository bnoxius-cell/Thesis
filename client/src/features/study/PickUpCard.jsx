import { Button, Card } from "@/shared/ui";
import { daysAgoText } from "@/shared/lib/dates";

// "Pick up where you left off" (Figma 76:1082) for one subject: its newest reviewer that is ready.
// The reviewer list doesn't say which one has a Learning Mode session open, so this is recency only.
// Nothing renders when the subject has no ready reviewer.
export default function PickUpCard({ reviewers, now }) {
  const reviewer = reviewers.find((r) => r.status === "ready");
  if (!reviewer) return null;
  const added = daysAgoText(reviewer.generatedAt || reviewer.createdAt, now).toLowerCase();

  return (
    <Card as="section" className="subject-card" aria-labelledby="subject-pickup-title">
      <h2 id="subject-pickup-title" className="subject-card__title">Pick up where you left off</h2>
      <div className="subject-row subject-row--flush">
        <span className="subject-row__text">
          <strong className="subject-row__title">{reviewer.title}</strong>
          <span className="subject-row__meta">Reviewer · added {added}</span>
        </span>
        <Button to={`/study/reviewers/${reviewer._id}`} aria-label={`Open ${reviewer.title}`}>Open</Button>
      </div>
    </Card>
  );
}
