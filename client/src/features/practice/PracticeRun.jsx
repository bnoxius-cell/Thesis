import PracticeQuestion from "./PracticeQuestion";
import PracticeResult from "./PracticeResult";
import usePracticeRun from "./usePracticeRun";

// A session once it is loaded: its questions, then its result.
export default function PracticeRun({ reviewerId, session, from }) {
  const run = usePracticeRun(reviewerId, session);
  if (run.summary?.session) return <PracticeResult reviewerId={reviewerId} from={from} summary={run.summary} />;
  if (!run.question) return null;
  return <PracticeQuestion run={run} />;
}
