import { useCallback, useEffect } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import { useFocusView } from "@/app/shell/focusView";
import usePageTitle from "@/app/usePageTitle";
import PracticeRun from "./PracticeRun";
import usePracticeSession from "./usePracticeSession";
import "./practice.css";

// The page behind Exit when nothing says where the student came from.
const reviewerPath = (id) => `/study/reviewers/${id}`;

function Message({ icon, title, children, reviewerId, onRetry }) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      titleAs="h1"
      actions={
        <>
          <Button to={reviewerPath(reviewerId)} replace>Back to reviewer</Button>
          {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
        </>
      }
    >
      {children}
    </EmptyState>
  );
}

// Learning Mode (Figma 76:840, 77:452, 77:494): a focus screen with no shell. Exit and the reviewer's
// name sit on top, one 640px column in the middle. /practice?mode=all|weak resumes the open session
// when there is one, and `new=1` starts a fresh one anyway.
export default function PracticePage() {
  const { reviewerId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const stateFrom = useLocation().state?.from;
  const from = typeof stateFrom === "string" && stateFrom.startsWith("/") ? stateFrom : "";
  const mode = params.get("mode") === "weak" ? "weak" : "all";
  const data = usePracticeSession(reviewerId, mode, params.get("new") === "1");
  const { reviewer, status } = data;
  useFocusView(true);
  usePageTitle("Practice");

  const exit = useCallback(() => {
    navigate(from || reviewerPath(reviewerId), { replace: true });
  }, [navigate, from, reviewerId]);

  // Esc leaves, as Exit does. The session stays open, so Start Learning Mode there can pick it up.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exit]);

  const label = reviewer ? [reviewer.course, reviewer.title].filter(Boolean).join(" · ") : "";

  return (
    <div className="practice">
      <header className="practice-top">
        <Button variant="ghost" onClick={exit}>Exit</Button>
        <span className="practice-top__label">{label}</span>
      </header>
      <div className="practice-main">
        {status === "loading" && (
          <div className="practice-column" role="status" aria-label="Getting your questions ready">
            <Skeleton height="20px" width="30%" />
            <Skeleton height="120px" />
            <Skeleton height="240px" />
          </div>
        )}
        {status === "loaded" && <PracticeRun key={data.session._id} reviewerId={reviewerId} session={data.session} from={from} />}
        {status === "missing" && (
          <Message icon={FileQuestion} title="Reviewer not found" reviewerId={reviewerId}>
            It may have been deleted, or it isn't in your account.
          </Message>
        )}
        {status === "unready" && (
          <Message icon={FileQuestion} title="This reviewer isn't ready yet" reviewerId={reviewerId}>
            Learning Mode opens once its questions are made.
          </Message>
        )}
        {status === "failed" && (
          <Message icon={FileQuestion} title="Couldn't start Learning Mode" reviewerId={reviewerId} onRetry={data.reload}>
            {data.error}
          </Message>
        )}
      </div>
    </div>
  );
}
