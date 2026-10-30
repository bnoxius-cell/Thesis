import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import ReviewerView from "../components/reviewer/ReviewerView";
import { REVIEWERS_TOUR } from "../utils/tours";

// One reviewer (/study/reviewers/:id): notes, progress and Learning Mode.
export default function ReviewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <AppShell mainClassName="reviewer-page" tour={{ page: "reviewers", title: "Study", steps: REVIEWERS_TOUR, view: "detail" }}>
      <ReviewerView key={id} reviewerId={id} onBack={() => navigate("/study?tab=reviewers")} />
    </AppShell>
  );
}
