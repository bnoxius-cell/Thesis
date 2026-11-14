import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { Button, Chip, EmptyState, Skeleton, Tabs } from "@/shared/ui";
import Page from "@/app/shell/Page";
import { useGlobalAdd } from "@/app/shell/add/addContext";
import useAddHere from "@/app/shell/add/useAddHere";
import UploadDialog from "@/features/files/UploadDialog";
import useFlashcards from "@/features/flashcards/useFlashcards";
import useTaskDone from "@/features/tasks/useTaskDone";
import useNow from "@/shared/hooks/useNow";
import useSelectedTabInView from "@/shared/hooks/useSelectedTabInView";
import { subjectMeta } from "@/utils/subjectColors";
import ClassSchedule from "./ClassSchedule";
import NextUpList from "./NextUpList";
import PickUpCard from "./PickUpCard";
import SubjectCounts from "./SubjectCounts";
import SubjectDialogs from "./SubjectDialogs";
import SubjectFiles from "./SubjectFiles";
import SubjectMenu from "./SubjectMenu";
import SubjectPractice from "./SubjectPractice";
import SubjectTasks from "./SubjectTasks";
import { classesThisWeek, examChipText, upcomingEntries } from "./subjectClasses";
import useReviewers from "./useReviewers";
import useSubject from "./useSubject";
import useSubjectFiles from "./useSubjectFiles";
import "./subject.css";

const BACK = { to: "/study", label: "Back to Study" };
const TAB_VALUES = ["overview", "tasks", "practice", "files"];

// Overview is the bare path; the others add ?tab=. Each tab is a history step, so Back returns to
// the tab the student was on. Practice's Flashcards side adds &show=flashcards. Practice used to be the
// Reviewers tab, so ?tab=reviewers still opens it.
const tabPath = (id, tab) => `/study/subjects/${id}${tab === "overview" ? "" : `?tab=${tab}`}`;
const tabFromParams = (params) => {
  const value = params.get("tab") === "reviewers" ? "practice" : params.get("tab");
  return TAB_VALUES.includes(value) ? value : "overview";
};

function SubjectSkeleton() {
  return (
    <div className="subject-columns" role="status" aria-label="Loading this subject">
      <div className="subject-column">
        <Skeleton className="subject-skeleton" height="220px" />
        <Skeleton className="subject-skeleton" height="120px" />
      </div>
      <div className="subject-column">
        <Skeleton className="subject-skeleton" height="140px" />
      </div>
    </div>
  );
}

// One subject (Figma 76:878): its code and term with an exam chip, then four tabs picked by
// ?tab= (an unknown value shows Overview). Overview is the frame: Next up and Pick up on the left,
// Class schedule and counts on the right (one column on phones). Tasks is built from the shared pieces
// and isn't in the frame; Practice (Reviewers | Flashcards, ?show=) is FC-F17; Files is Figma 157:1477.
// Notes aren't here.
// The header More menu edits or deletes the subject (deleting returns to Study). An unknown or
// foreign id shows "Subject not found". The files and uploads live here, not in the Files tab, so an
// upload goes on while another tab is open.
function SubjectView({ subjectId }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const now = useNow();
  const [dialog, setDialog] = useState(null); // edit or delete: { type, subject }
  const data = useSubject(subjectId);
  const { reviewers: allReviewers, refresh: refreshReviewers } = useReviewers();
  const { subject, status } = data;
  const files = useSubjectFiles(subjectId, Boolean(subject?.archivedAt));
  const setDone = useTaskDone(data.setTasks);
  const tab = tabFromParams(params);
  const show = params.get("show") === "flashcards" ? "flashcards" : "reviewers";
  // Decks load only while the Flashcards side is showing: the Reviewers side and the other tabs never ask.
  const flashcards = useFlashcards({ enabled: tab === "practice" && show === "flashcards" });
  const reviewers = allReviewers && allReviewers.filter((r) => r.subject === subjectId);
  useSelectedTabInView(`subject-tab-${tab}`, status === "ready");
  const { open: openAdd } = useGlobalAdd();
  // The header Add starts a task or a reviewer on this subject; each kind refreshes its own part of the page.
  useAddHere({
    subject,
    openUpload: () => files.library.status === "ready" && files.openUpload(),
    onAdded: (kind, result) => {
      if (kind === "task") data.setTasks((list) => [...list, result]);
      else if (kind === "reviewer") refreshReviewers();
      else if (kind === "flashcards") {
        flashcards.refresh(result?.deck?.id);
        data.refresh();
      }
      else if (kind !== "subject") data.refresh();
    },
  });

  if (status !== "ready") {
    return (
      <Page title="Subject" back={BACK}>
        {status === "loading" && <SubjectSkeleton />}
        {status === "missing" && (
          <EmptyState
            icon={FileQuestion}
            title="Subject not found"
            actions={<Button to="/study">Back to Study</Button>}
          >
            It may have been deleted, or it isn't in your account.
          </EmptyState>
        )}
        {status === "failed" && (
          <div className="subject-failed" role="alert">
            <p>{data.error}</p>
            <Button variant="secondary" onClick={data.reload}>Try again</Button>
          </div>
        )}
      </Page>
    );
  }

  const meta = subjectMeta(subject);
  const exam = examChipText(data.entries, subject, now);
  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "tasks", label: "Tasks", count: data.tasks.length },
    { value: "practice", label: "Practice" },
    { value: "files", label: "Files" },
  ].map((item) => ({
    ...item,
    to: tabPath(subjectId, item.value),
    id: `subject-tab-${item.value}`,
    panelId: "subject-panel",
  }));

  // Each Segment choice is a history step, like Study's; Reviewers is the bare tab.
  const changeShow = (value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "reviewers") next.delete("show");
      else next.set("show", value);
      return next;
    });

  const changed = () => (dialog.type === "delete" ? navigate("/study") : data.refresh());
  // The subject's count of files is from when the page loaded; once its files are here they are the
  // truth (uploads, moves and deletes in this visit included), so the delete dialog asks the right way.
  const { library } = files;
  const fileCount =
    library.status === "ready"
      ? library.files.filter((file) => file.location.id === subjectId && !library.leavingIds.includes(file.id)).length
      : subject.counts.files;
  return (
    <Page
      title={subject.name}
      back={BACK}
      action={
        <SubjectMenu
          subject={subject}
          className="subject-more"
          onEdit={(s) => setDialog({ type: "edit", subject: s })}
          onDelete={(s) => setDialog({ type: "delete", subject: { ...s, counts: { ...s.counts, files: fileCount } } })}
        />
      }
    >
      <div className="subject-body">
        {(meta || exam) && (
          <p className="subject-meta">
            {meta && <span>{meta}</span>}
            {exam && <Chip tone="watch">{exam}</Chip>}
          </p>
        )}
        <Tabs items={tabs} value={tab} label="Subject sections" className="subject-tabs" />
        <div key={tab} className="subject-panel tab-panel-in" role="tabpanel" id="subject-panel" aria-labelledby={`subject-tab-${tab}`}>
          {tab === "overview" && (
            <div className="subject-columns">
              <div className="subject-column">
                <NextUpList
                  tasks={data.tasks}
                  upcoming={upcomingEntries(data.entries, subject, now)}
                  now={now}
                  onToggle={setDone}
                  allTasksTo={tabPath(subjectId, "tasks")}
                />
                <PickUpCard reviewers={reviewers ?? []} now={now} />
              </div>
              <div className="subject-column">
                <ClassSchedule classes={classesThisWeek(data.entries, subject, now)} />
                <SubjectCounts
                  openTasks={data.tasks.length}
                  reviewers={reviewers?.length ?? 0}
                  tasksTo={tabPath(subjectId, "tasks")}
                  reviewersTo={tabPath(subjectId, "practice")}
                />
              </div>
            </div>
          )}
          {tab === "tasks" && (
            <SubjectTasks
              tasks={data.tasks}
              doneTasks={data.doneTasks}
              now={now}
              onToggle={setDone}
              onNew={() => openAdd("task")}
            />
          )}
          {tab === "practice" && (
            <SubjectPractice
              subject={subject}
              show={show}
              onShow={changeShow}
              reviewers={reviewers}
              flashcards={flashcards}
              entries={data.entries}
              now={now}
              onNewReviewer={() => openAdd("reviewer")}
              onMake={() => openAdd("flashcards")}
            />
          )}
          {tab === "files" && <SubjectFiles subject={subject} library={files.library} block={files.block} uploadStatus={files.dialog.status} openUpload={files.openUpload} />}
        </div>
      </div>
      <SubjectDialogs dialog={dialog} onClose={() => setDialog(null)} onChanged={changed} />
      {files.dialog.isOpen && library.status === "ready" && (
        <UploadDialog
          uploads={files.uploads}
          place={files.dialog.place}
          initialFiles={files.dialog.initialFiles}
          locations={library.locations}
          usage={library.usage}
          block={files.block}
          onFolderCreated={library.refresh}
          onClose={files.dialog.close}
        />
      )}
    </Page>
  );
}

// Keyed by the subject, so moving to another subject starts with clean state: its own tab data,
// dialogs, and no upload queue left over from the last one.
export default function SubjectPage() {
  const { subjectId } = useParams();
  return <SubjectView key={subjectId} subjectId={subjectId} />;
}
