import { FileText } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";
import ReviewerList from "./ReviewerList";

// The Reviewers tab: this subject's reviewers, newest first, with the same rows as Study.
// `reviewers` is null when the list could not load. ReviewerList carries the empty state; with rows,
// "New reviewer" sits above them. `onNew` opens New reviewer on this subject.
export default function SubjectReviewers({ reviewers, onNew }) {
  if (!reviewers) {
    return (
      <EmptyState icon={FileText} title="Couldn't load your reviewers">
        Check your connection, then reload the page.
      </EmptyState>
    );
  }
  return (
    <div className="subject-stack">
      {reviewers.length > 0 && (
        <div className="subject-actions">
          <Button variant="secondary" onClick={onNew}>New reviewer</Button>
        </div>
      )}
      <ReviewerList reviewers={reviewers} onNew={onNew} />
    </div>
  );
}
