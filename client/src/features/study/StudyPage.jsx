import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FileText } from "lucide-react";
import { AddButton, Button, EmptyState, Skeleton, Tabs } from "@/shared/ui";
import Page from "@/app/shell/Page";
import useNow from "@/shared/hooks/useNow";
import NewReviewerDialog from "./NewReviewerDialog";
import PickUpHero from "./PickUpHero";
import ReviewerList from "./ReviewerList";
import StudyEmpty from "./StudyEmpty";
import SubjectDialogs from "./SubjectDialogs";
import SubjectGrid from "./SubjectGrid";
import useReviewers from "./useReviewers";
import useSubjects from "./useSubjects";
import "./study.css";
import "./study-reviewers.css";

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
// URL-driven tab pair (?tab=). On Subjects, the "+", the dashed New subject card, a card's More menu
// and the empty page's button open the New subject, Edit and Delete dialogs (not drawn in Figma).
// On Reviewers, the "+", the "New reviewer" link and the empty states' Upload button open the New
// reviewer dialog (78:1272); a new reviewer shows as a processing row and turns ready by itself.
// Active | Archived and End this term wait for an archive backend, so they don't render.
export default function StudyPage() {
  const [params] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "subjects";
  const now = useNow();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const [uploading, setUploading] = useState(false);
  const data = useSubjects();
  const { reviewers, settled, limits, refresh: refreshReviewers } = useReviewers();

  const isNewAccount = data.status === "ready" && settled && data.subjects.length === 0 && !reviewers?.length;
  const tabs = [
    { value: "subjects", label: "Subjects", count: data.subjects.length, to: "/study", id: "study-tab-subjects", panelId: "study-panel" },
    { value: "reviewers", label: "Reviewers", count: reviewers?.length, to: "/study?tab=reviewers", id: "study-tab-reviewers", panelId: "study-panel" },
  ];

  const openNew = () => setDialog({ type: "new" });
  const open = (type) => (subject) => setDialog({ type, subject });
  const openUpload = () => setUploading(true);
  const showAdd = data.status === "ready" && !isNewAccount;
  const reviewersTab = tab === "reviewers";

  const uploaded = () => {
    toast.success("Making your reviewer. It will be ready here in a moment.");
    refreshReviewers();
    setUploading(false);
    if (!reviewersTab) navigate("/study?tab=reviewers");
  };

  return (
    <Page
      title="Study"
      action={showAdd && (
        <AddButton label={reviewersTab ? "New reviewer" : "Add a subject"} onClick={reviewersTab ? openUpload : openNew} />
      )}
    >
      {data.status === "loading" && <StudySkeleton />}
      {data.status === "failed" && (
        <div className="study-failed" role="alert">
          <p>{data.error}</p>
          <Button variant="secondary" onClick={data.reload}>Try again</Button>
        </div>
      )}
      {isNewAccount && <StudyEmpty onAddSubject={openNew} onUpload={openUpload} />}
      {data.status === "ready" && !isNewAccount && (
        <div className="study-body">
          <PickUpHero reviewers={reviewers} />
          <div className="study-tabsrow">
            <Tabs items={tabs} value={tab} label="Study sections" className="study-tabs" />
            {reviewersTab && (
              <button type="button" className="study-tabsrow__link" onClick={openUpload}>New reviewer</button>
            )}
          </div>
          <div role="tabpanel" id="study-panel" aria-labelledby={`study-tab-${tab}`}>
            {tab === "subjects" && data.subjects.length > 0 && (
              <SubjectGrid
                subjects={data.subjects}
                entries={data.entries}
                now={now}
                onNew={openNew}
                onEdit={open("edit")}
                onDelete={open("delete")}
              />
            )}
            {tab === "subjects" && data.subjects.length === 0 && (
              <EmptyState icon={FileText} title="No subjects yet" actions={<Button onClick={openNew}>Add subject</Button>}>
                They will show up here once you add them.
              </EmptyState>
            )}
            {reviewersTab && reviewers && <ReviewerList reviewers={reviewers} onNew={openUpload} />}
            {reviewersTab && !reviewers && (
              <EmptyState icon={FileText} title="Couldn't load your reviewers">
                Check your connection, then reload the page.
              </EmptyState>
            )}
          </div>
        </div>
      )}
      {uploading && (
        <NewReviewerDialog
          subjects={data.subjects}
          limits={limits}
          onClose={() => setUploading(false)}
          onCreated={uploaded}
        />
      )}
      <SubjectDialogs dialog={dialog} onClose={() => setDialog(null)} onChanged={data.refresh} />
    </Page>
  );
}
