import { FileText, Info } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";

// What the page shows instead of notes while the AI is still writing the reviewer, or when it
// could not. The page keeps checking by itself (useReviewer), so there is nothing to press.
export default function ReviewerWaiting({ reviewer }) {
  if (reviewer.status === "failed") {
    return (
      <div role="alert">
        <EmptyState
          icon={Info}
          title="We couldn't make this reviewer"
          actions={<Button variant="secondary" to="/study?tab=reviewers">Back to reviewers</Button>}
        >
          {reviewer.error || "Something went wrong on our side."}
        </EmptyState>
      </div>
    );
  }
  return (
    <div role="status">
      <EmptyState icon={FileText} title="Making your reviewer">
        {`Reading your PDF and writing ${reviewer.questionTarget} practice questions. This usually takes under a minute. You can leave this page, it keeps going.`}
      </EmptyState>
    </div>
  );
}
