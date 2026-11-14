import { useState } from "react";
import { useMatch, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import Page from "@/app/shell/Page";
import { useGlobalAdd } from "@/app/shell/add/addContext";
import useAddHere from "@/app/shell/add/useAddHere";
import RedirectTo from "@/app/RedirectTo";
import useFlashcards from "@/features/flashcards/useFlashcards";
import useNow from "@/shared/hooks/useNow";
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
// /study and /study/practice). The dashed New subject card, the empty states' buttons and the "New reviewer"
// link open the global add's dialogs (app/shell/add); a card's More menu opens Edit and Delete here (not
// drawn in Figma). On Practice, a Reviewers | Flashcards Segment (?show=) sits in the tab row. A new
// reviewer shows as a processing row and turns ready by itself.
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
  const [dialog, setDialog] = useState(null);
  const data = useSubjects();
  const { reviewers, settled, refresh: refreshReviewers } = useReviewers({ poll: practiceTab });

  // Flashcards load once, when that side opens: the Reviewers side and the other tabs never ask for them. A
  // student with no subjects and no reviewers (the new-account screen) is the one other case: a deck of their
  // own may be all they have, so it is looked up first and that screen only shows when there is none.
  const flashcardsSide = practiceTab && show === "flashcards";
  const looksNew = data.status === "ready" && settled && data.subjects.length === 0 && !reviewers?.length;
  const flashcards = useFlashcards({ enabled: flashcardsSide || looksNew });
  const checkingDecks = looksNew && !flashcardsSide && (flashcards.status === "idle" || flashcards.status === "loading");
  const isNewAccount = looksNew && !flashcardsSide && !checkingDecks && !flashcards.data?.decks.length;

  const { open: openAdd } = useGlobalAdd();
  const openNew = () => openAdd("subject");
  const openUpload = () => openAdd("reviewer");
  const openMake = () => openAdd("flashcards");
  const open = (type) => (subject) => setDialog({ type, subject });
  // The header Add lands here: refresh what changed. No jump to Practice, the toast's View goes there.
  useAddHere({
    subjects: data.subjects,
    onAdded: (kind, result) => {
      if (kind === "reviewer") refreshReviewers();
      else if (kind === "flashcards") flashcards.refresh(result?.deck?.id);
      else data.refresh();
    },
  });

  // Each Segment choice is a history step (Back and reload keep it); Reviewers is the bare path.
  const changeShow = (value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "reviewers") next.delete("show");
      else next.set("show", value);
      return next;
    });

  return (
    <Page title="Study">
      {(data.status === "loading" || checkingDecks) && <StudySkeleton />}
      {data.status === "failed" && (
        <div className="study-failed" role="alert">
          <p>{data.error}</p>
          <Button variant="secondary" onClick={data.reload}>Try again</Button>
        </div>
      )}
      {isNewAccount && <StudyEmpty onAddSubject={openNew} onUpload={openUpload} />}
      {data.status === "ready" && !checkingDecks && !isNewAccount && (
        <div className="study-body">
          {!practiceTab && <PickUpHero reviewers={reviewers} />}
          <div className={`study-tabsrow${practiceTab ? "" : " study-tabsrow--subjects"}`}>
            <StudyTabs value={tab} subjectsCount={data.subjects.length} />
            {practiceTab && <PracticeSwitch show={show} onShow={changeShow} onNew={openUpload} onMake={openMake} />}
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
            {practiceTab && (
              <PracticePanel
                show={show}
                reviewers={reviewers}
                flashcards={flashcards}
                subjects={data.subjects}
                entries={data.entries}
                now={now}
                onNew={openUpload}
                onMake={openMake}
              />
            )}
          </div>
        </div>
      )}
      <SubjectDialogs dialog={dialog} onClose={() => setDialog(null)} onChanged={data.refresh} />
    </Page>
  );
}
