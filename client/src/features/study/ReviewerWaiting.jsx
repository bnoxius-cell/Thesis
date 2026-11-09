import { FileText, Info } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";

// The status check's { stage, done, total } as a short line, or "" before there is anything to say.
function progressText(making) {
  if (!making?.total) return "";
  if (making.stage === "reading") return `Reading pictures: ${making.done} of ${making.total}.`;
  return making.stage === "writing" ? `Writing questions: ${making.done} of ${making.total}.` : "";
}

// What the page shows instead of notes while the AI is still writing the reviewer, or when it
// could not. The page keeps checking by itself (useReviewer), so there is nothing to press.
// `making` is that check's progress, once there is one.
export default function ReviewerWaiting({ reviewer, making }) {
  if (reviewer.status === "failed") {
    return (
      <div role="alert">
        <EmptyState
          icon={Info}
          title="We couldn't make this reviewer"
          actions={<Button variant="secondary" to="/study/practice">Back to reviewers</Button>}
        >
          {reviewer.error || "Something went wrong on our side."}
        </EmptyState>
      </div>
    );
  }
  const progress = progressText(making);
  return (
    <div role="status">
      <EmptyState icon={FileText} title="Making your reviewer">
        {`Reading your files and writing ${reviewer.questionTarget} practice questions. This usually takes under a minute. You can leave this page, it keeps going.`}
        {progress && <span className="reviewer-waiting__progress">{progress}</span>}
      </EmptyState>
    </div>
  );
}
