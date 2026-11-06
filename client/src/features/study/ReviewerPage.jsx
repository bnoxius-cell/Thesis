import { useLocation, useParams } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import Page from "@/app/shell/Page";
import ReviewerMoreMenu from "./ReviewerMoreMenu";
import ReviewerReader from "./ReviewerReader";
import ReviewerSidePanel from "./ReviewerSidePanel";
import ReviewerStatusChip from "./ReviewerStatusChip";
import ReviewerWaiting from "./ReviewerWaiting";
import { practiceLink } from "./practiceLink";
import { reviewerSourceLine } from "./reviewerStatus";
import useReviewer from "./useReviewer";
import "./reviewer.css";

const BACK = { to: "/study/practice", label: "Back to reviewers" };

// One reviewer (Figma 76:1110): where it came from and its status, then the notes. While it is
// still being made, or if that failed, a short message takes the place of the notes. An unknown or
// foreign id shows "Reviewer not found".
export default function ReviewerPage() {
  const { reviewerId } = useParams();
  const location = useLocation();
  const data = useReviewer(reviewerId);
  const { reviewer, status } = data;

  if (status !== "loaded") {
    return (
      <Page title="Reviewer" back={BACK}>
        {status === "loading" && (
          <div className="reviewer-body" role="status" aria-label="Loading this reviewer">
            <Skeleton className="reviewer-skeleton" height="320px" />
          </div>
        )}
        {status === "missing" && (
          <EmptyState
            icon={FileQuestion}
            title="Reviewer not found"
            actions={<Button to="/study/practice">Back to reviewers</Button>}
          >
            It may have been deleted, or it isn't in your account.
          </EmptyState>
        )}
        {status === "failed" && (
          <div className="reviewer-failed" role="alert">
            <p>{data.error}</p>
            <Button variant="secondary" onClick={data.reload}>Try again</Button>
          </div>
        )}
      </Page>
    );
  }

  const ready = reviewer.status === "ready";
  const from = location.pathname + location.search;
  const link = (mode, options) => practiceLink(reviewer._id, mode, from, options);
  const links = {
    resume: link(data.openSession?.mode === "weak" ? "weak" : "all"),
    weak: link("weak"),
  };
  // With a session open, plain Start would pick it up again: that is Resume's job.
  const start = link("all", { fresh: Boolean(data.openSession) });
  const withProgress = {
    ...reviewer,
    sessions: data.progress?.sessions,
    lastScore: data.progress?.lastScore,
    hasOpenSession: Boolean(data.openSession),
  };

  return (
    <Page
      title={reviewer.title}
      back={BACK}
      action={reviewer.status !== "processing" && <ReviewerMoreMenu reviewer={reviewer} />}
    >
      <div className="reviewer-body">
        <div className="reviewer-meta">
          <span>{reviewerSourceLine(reviewer)}</span>
          <ReviewerStatusChip reviewer={withProgress} />
          {ready && <Button className="reviewer-meta__start" {...start}>Start Learning Mode</Button>}
        </div>
        {ready ? (
          <div className="reviewer-columns">
            <div className="reviewer-main">
              <ReviewerReader reviewer={reviewer} />
              {reviewer.source?.truncated && (
                <p className="reviewer-note">
                  Your PDF was long, so only the first part was used. For the rest, split it and upload the second half.
                </p>
              )}
            </div>
            <ReviewerSidePanel
              reviewer={reviewer}
              openSession={data.openSession}
              progress={data.progress}
              links={links}
            />
          </div>
        ) : (
          <ReviewerWaiting reviewer={reviewer} />
        )}
      </div>
    </Page>
  );
}
