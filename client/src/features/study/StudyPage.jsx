import { useState } from "react";
import { useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FileText } from "lucide-react";
import { AddButton, Button, EmptyState, Skeleton } from "@/shared/ui";
import Page from "@/app/shell/Page";
import RedirectTo from "@/app/RedirectTo";
import useNow from "@/shared/hooks/useNow";
import NewReviewerDialog from "./NewReviewerDialog";
import PickUpHero from "./PickUpHero";
import PracticePanel from "./PracticePanel";
import PracticeSwitch from "./PracticeSwitch";
import StudyEmpty from "./StudyEmpty";
import StudyTabs from "./StudyTabs";
import SubjectDialogs from "./SubjectDialogs";
import SubjectGrid from "./SubjectGrid";
import useReviewers from "./useReviewers";
import useSubjects from "./useSubjects";
import "./study.css";
import "./study-reviewers.css";

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

// Study (Figma 72:3, 75:799, 78:1526, 144:654): Pick up where you left off, then the Subjects | Practice |
// Files track (Files is its own page, features/files/FilesPage; Subjects and Practice are path-driven:
// /study and /study/practice). On Subjects, the "+", the dashed New subject card, a card's More menu
// and the empty page's button open the New subject, Edit and Delete dialogs (not drawn in Figma). On Practice, a Reviewers | Flashcards Segment (?show=) sits in the tab row;
// the "+", the "New reviewer" link and the empty states' Upload button open the New reviewer dialog
// (78:1272), and a new reviewer shows as a processing row and turns ready by itself.
// The Subjects tab row is 100px tall on desktop (the frame's spacer, built literally, owner choice).
// Active | Archived and End this term wait for an archive backend, so they don't render.
export default function StudyPage() {
  const [params] = useSearchParams();
  // The old Reviewers tab address: a route can't match on a query, so it is caught here.
  if (params.get("tab") === "reviewers") {
    return <RedirectTo to="/study/practice" drop={["tab"]} />;
  }
  return <Study />;
}

function Study() {
  const practiceTab = Boolean(useMatch("/study/practice"));
  const tab = practiceTab ? "practice" : "subjects";
  const [params, setParams] = useSearchParams();
  const show = params.get("show") === "flashcards" ? "flashcards" : "reviewers";
  const now = useNow();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const [uploading, setUploading] = useState(false);
  const data = useSubjects();
  const { reviewers, settled, limits, refresh: refreshReviewers } = useReviewers({ poll: practiceTab });

  const isNewAccount = data.status === "ready" && settled && data.subjects.length === 0 && !reviewers?.length;

  const openNew = () => setDialog({ type: "new" });
  const open = (type) => (subject) => setDialog({ type, subject });
  const openUpload = () => setUploading(true);
  const reviewersShown = practiceTab && show === "reviewers";
  const showAdd = data.status === "ready" && (!practiceTab || reviewersShown);

  // Each Segment choice is a history step (Back and reload keep it); Reviewers is the bare path.
  const changeShow = (value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "reviewers") next.delete("show");
      else next.set("show", value);
      return next;
    });

  const uploaded = () => {
    toast.success("Making your reviewer. It will be ready here in a moment.");
    refreshReviewers();
    setUploading(false);
    if (!practiceTab) navigate("/study/practice");
  };

  return (
    <Page
      title="Study"
      action={showAdd && (
        <AddButton label={practiceTab ? "New reviewer" : "Add a subject"} onClick={practiceTab ? openUpload : openNew} />
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
          {!practiceTab && <PickUpHero reviewers={reviewers} />}
          <div className={`study-tabsrow${practiceTab ? "" : " study-tabsrow--subjects"}`}>
            <StudyTabs value={tab} subjectsCount={data.subjects.length} />
            {practiceTab && <PracticeSwitch show={show} onShow={changeShow} onNew={openUpload} />}
          </div>
          <div role="tabpanel" id="study-panel" aria-labelledby={`study-tab-${tab}`}>
            {!practiceTab && data.subjects.length > 0 && (
              <SubjectGrid
                subjects={data.subjects}
                entries={data.entries}
                now={now}
                onNew={openNew}
                onEdit={open("edit")}
                onDelete={open("delete")}
              />
            )}
            {!practiceTab && data.subjects.length === 0 && (
              <EmptyState icon={FileText} title="No subjects yet" actions={<Button onClick={openNew}>Add subject</Button>}>
                They will show up here once you add them.
              </EmptyState>
            )}
            {practiceTab && <PracticePanel show={show} reviewers={reviewers} onNew={openUpload} onShow={changeShow} />}
          </div>
        </div>
      )}
      {uploading && (
        <NewReviewerDialog
          subjects={data.subjects}
          limits={limits}
          onClose={() => setUploading(false)}
          onCreated={uploaded}
          onSubjectCreated={data.refresh}
        />
      )}
      <SubjectDialogs dialog={dialog} onClose={() => setDialog(null)} onChanged={data.refresh} />
    </Page>
  );
}
