import { FileText } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";
import ReviewerRow from "./ReviewerRow";

// The Reviewers tab body (Figma 73:386): one row per reviewer, newest first. Rows keep their keys,
// so the list's first-load stagger never replays when a row is added or its status changes.
export default function ReviewerList({ reviewers, onNew }) {
  if (reviewers.length === 0) {
    return (
      <EmptyState icon={FileText} title="No reviewers yet" actions={<Button onClick={onNew}>Upload a reviewer</Button>}>
        Upload a PDF of your notes and get practice questions from it.
      </EmptyState>
    );
  }
  return (
    <ul className="study-reviewers stagger">
      {reviewers.map((reviewer) => (
        <li key={reviewer._id}>
          <ReviewerRow reviewer={reviewer} />
        </li>
      ))}
    </ul>
  );
}
