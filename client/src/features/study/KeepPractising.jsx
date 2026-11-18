import { FileText, Plus } from "lucide-react";
import { Button, Card, Skeleton } from "@/shared/ui";
import { daysAgoText } from "@/shared/lib/dates";

// "Keep practising" (Figma OV-F1) for one subject: its newest reviewer that is ready, with Open. The reviewer list
// doesn't say which one has a Learning Mode session open, so this is recency only. With none ready it says so and
// offers "New reviewer" (`onNew`), so the card is always there and the column doesn't jump between subjects.
// `reviewers` is null until they have loaded.
export default function KeepPractising({ reviewers, now, onNew }) {
  const reviewer = reviewers?.find((r) => r.status === "ready");

  return (
    <Card as="section" className="subject-card keep-practising" aria-labelledby="keep-practising-title">
      <h2 id="keep-practising-title" className="subject-card__title">Keep practising</h2>
      {reviewers == null && <Skeleton height="44px" />}
      {reviewer && (
        <>
          <div className="keep-practising__row">
            <span className="keep-practising__tile" aria-hidden="true">
              <FileText size={20} />
            </span>
            <span className="subject-row__text">
              <strong className="subject-row__title">{reviewer.title}</strong>
              <span className="subject-row__meta">Reviewer · added {daysAgoText(reviewer.generatedAt || reviewer.createdAt, now).toLowerCase()}</span>
            </span>
          </div>
          <Button variant="secondary" to={`/study/reviewers/${reviewer._id}`} aria-label={`Open ${reviewer.title}`}>Open reviewer</Button>
        </>
      )}
      {reviewers && !reviewer && (
        <>
          <p className="subject-card__quiet">
            {reviewers.length === 0
              ? "No reviewers yet. Turn your notes or a PDF into practice questions."
              : "Your reviewers aren't ready yet."}
          </p>
          <Button variant="ghost" icon={Plus} className="subject-card__add" onClick={onNew}>New reviewer</Button>
        </>
      )}
    </Card>
  );
}
