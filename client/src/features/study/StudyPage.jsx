import { useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { Button, EmptyState, Skeleton, Tabs } from "@/shared/ui";
import Page from "@/app/shell/Page";
import useNow from "@/shared/hooks/useNow";
import PickUpHero from "./PickUpHero";
import StudyEmpty from "./StudyEmpty";
import SubjectGrid from "./SubjectGrid";
import useReviewers from "./useReviewers";
import useSubjects from "./useSubjects";
import "./study.css";

const TABS = ["subjects", "reviewers"];

function StudySkeleton() {
  return (
    <div className="study-body" role="status" aria-label="Loading your subjects">
      <Skeleton className="study-skeleton" height="220px" />
      <div className="study-grid">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="study-skeleton" height="168px" />)}
      </div>
    </div>
  );
}

// Study (Figma 72:3, 75:799, 78:1526): Pick up where you left off, then Subjects | Reviewers as a
// URL-driven tab pair (?tab=). The Reviewers list arrives with the next batch. The "+", the dashed
// New subject card, a card's More menu, Active | Archived and End this term wait for what they open
// (no dialog is drawn yet, and archiving has no backend), so none of them render.
export default function StudyPage() {
  const [params] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "subjects";
  const now = useNow();
  const data = useSubjects();
  const { reviewers, settled } = useReviewers();

  const isNewAccount = data.status === "ready" && settled && data.subjects.length === 0 && !reviewers?.length;
  const tabs = [
    { value: "subjects", label: "Subjects", count: data.subjects.length, to: "/study", id: "study-tab-subjects", panelId: "study-panel" },
    { value: "reviewers", label: "Reviewers", count: reviewers?.length, to: "/study?tab=reviewers", id: "study-tab-reviewers", panelId: "study-panel" },
  ];

  return (
    <Page title="Study">
      {data.status === "loading" && <StudySkeleton />}
      {data.status === "failed" && (
        <div className="study-failed" role="alert">
          <p>{data.error}</p>
          <Button variant="secondary" onClick={data.reload}>Try again</Button>
        </div>
      )}
      {isNewAccount && <StudyEmpty />}
      {data.status === "ready" && !isNewAccount && (
        <div className="study-body">
          <PickUpHero reviewers={reviewers} />
          <Tabs items={tabs} value={tab} label="Study sections" className="study-tabs" />
          <div role="tabpanel" id="study-panel" aria-labelledby={`study-tab-${tab}`}>
            {tab === "subjects" && data.subjects.length > 0 && (
              <SubjectGrid subjects={data.subjects} entries={data.entries} now={now} />
            )}
            {tab === "subjects" && data.subjects.length === 0 && (
              <EmptyState icon={FileText} title="No subjects yet">
                They will show up here once you add them.
              </EmptyState>
            )}
            {tab === "reviewers" && (
              <EmptyState icon={FileText} title="On its way">
                Your reviewers will be listed here soon.
              </EmptyState>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
