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

const BACK = { to: "/study?tab=reviewers", label: "Back to reviewers" };

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
            actions={<Button to="/study?tab=reviewers">Back to reviewers</Button>}
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
  const link = (mode) => practiceLink(reviewer._id, mode, location);
  const links = {
    resume: link(data.openSession?.mode === "weak" ? "weak" : "all"),
    weak: link("weak"),
  };
  const withProgress = { ...reviewer, sessions: data.progress?.sessions, lastScore: data.progress?.lastScore };

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
          {ready && <Button className="reviewer-meta__start" {...link("all")}>Start Learning Mode</Button>}
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
              <p className="reviewer-note">
                Made by AI from your PDF. It can get things wrong, so check anything that looks off against your notes.
              </p>
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
