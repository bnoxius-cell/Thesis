import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FileQuestion } from "lucide-react";
import { Button, Chip, EmptyState, Skeleton, Tabs } from "@/shared/ui";
import Page from "@/app/shell/Page";
import UploadTray from "@/features/files/UploadTray";
import NewTaskDialog from "@/features/tasks/NewTaskDialog";
import useTaskDone from "@/features/tasks/useTaskDone";
import useNow from "@/shared/hooks/useNow";
import { prefersLessMotion } from "@/utils/motion";
import { subjectMeta } from "@/utils/subjectColors";
import ClassSchedule from "./ClassSchedule";
import NewReviewerDialog from "./NewReviewerDialog";
import NextUpList from "./NextUpList";
import PickUpCard from "./PickUpCard";
import SubjectCounts from "./SubjectCounts";
import SubjectDialogs from "./SubjectDialogs";
import SubjectFiles from "./SubjectFiles";
import SubjectMenu from "./SubjectMenu";
import SubjectReviewers from "./SubjectReviewers";
import SubjectTasks from "./SubjectTasks";
import { classesThisWeek, examChipText, upcomingEntries } from "./subjectClasses";
import useReviewers from "./useReviewers";
import useSubject from "./useSubject";
import useSubjectFiles from "./useSubjectFiles";
import "./subject.css";

const BACK = { to: "/study", label: "Back to Study" };
const TAB_VALUES = ["overview", "tasks", "reviewers", "files"];

// Overview is the bare path; the others add ?tab=. Each tab is a history step, so Back returns to
// the tab the student was on.
const tabPath = (id, tab) => `/study/subjects/${id}${tab === "overview" ? "" : `?tab=${tab}`}`;

// On a narrow phone the tab track scrolls, so the selected tab is brought into view: at once when
// the page opens on it, with a short scroll when the student picks another one.
function useSelectedTabInView(tab, ready) {
  const opened = useRef(false);
  useEffect(() => {
    const selected = ready && document.getElementById(`subject-tab-${tab}`);
    if (!selected) return;
    const track = selected.parentElement;
    const reveal = (behavior) => {
      const trackBox = track.getBoundingClientRect();
      const tabBox = selected.getBoundingClientRect();
      const shift = tabBox.left < trackBox.left ? tabBox.left - trackBox.left : Math.max(0, tabBox.right - trackBox.right);
      if (shift) track.scrollBy({ left: shift, behavior });
    };
    reveal(opened.current && !prefersLessMotion() ? "smooth" : "auto");
    opened.current = true;
    // A count arriving later (Reviewers 1) widens a tab and can push the selected one out of view.
    const watcher = new ResizeObserver(() => reveal("auto"));
    Array.from(track.children).forEach((child) => watcher.observe(child));
    return () => watcher.disconnect();
  }, [tab, ready]);
}

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
// Class schedule and counts on the right (one column on phones). Tasks and Reviewers are built from
// the shared pieces and aren't in the frame; Files is Figma 157:1477. Notes and Practice aren't here.
// The header More menu edits or deletes the subject (deleting returns to Study). An unknown or
// foreign id shows "Subject not found". The files and uploads live here, not in the Files tab, so an
// upload goes on while another tab is open.
function SubjectView({ subjectId }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const now = useNow();
  const [dialog, setDialog] = useState(null); // edit or delete: { type, subject }
  const [adding, setAdding] = useState(null); // "task" | "reviewer"
  const data = useSubject(subjectId);
  const { reviewers: allReviewers, limits, refresh: refreshReviewers } = useReviewers();
  const { subject, status } = data;
  const files = useSubjectFiles(subjectId, Boolean(subject?.archivedAt));
  const setDone = useTaskDone(data.setTasks);
  const tab = TAB_VALUES.includes(params.get("tab")) ? params.get("tab") : "overview";
  const reviewers = allReviewers && allReviewers.filter((r) => r.subject === subjectId);
  useSelectedTabInView(tab, status === "ready");

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
    { value: "reviewers", label: "Reviewers", count: reviewers?.length },
    { value: "files", label: "Files" },
  ].map((item) => ({
    ...item,
    to: tabPath(subjectId, item.value),
    id: `subject-tab-${item.value}`,
    panelId: "subject-panel",
  }));

  const changed = () => (dialog.type === "delete" ? navigate("/study") : data.refresh());
  const taskAdded = (task) => {
    data.setTasks((list) => [...list, task]);
    toast.success("Task added.");
    setAdding(null);
  };
  const reviewerAdded = () => {
    toast.success("Making your reviewer. It will be ready here in a moment.");
    refreshReviewers();
    setAdding(null);
  };

  return (
    <Page
      title={subject.name}
      back={BACK}
      action={
        <SubjectMenu
          subject={subject}
          className="subject-more"
          onEdit={(s) => setDialog({ type: "edit", subject: s })}
          onDelete={(s) => setDialog({ type: "delete", subject: s })}
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
                  reviewersTo={tabPath(subjectId, "reviewers")}
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
              onNew={() => setAdding("task")}
            />
          )}
          {tab === "reviewers" && <SubjectReviewers reviewers={reviewers} onNew={() => setAdding("reviewer")} />}
          {tab === "files" && <SubjectFiles subject={subject} library={files.library} uploads={files.uploads} />}
        </div>
      </div>
      {adding === "task" && (
        <NewTaskDialog
          subjects={[subject]}
          defaultSubject={subject._id}
          onClose={() => setAdding(null)}
          onSaved={taskAdded}
        />
      )}
      {adding === "reviewer" && (
        <NewReviewerDialog
          subjects={[subject]}
          defaultSubject={subject._id}
          limits={limits}
          onClose={() => setAdding(null)}
          onCreated={reviewerAdded}
        />
      )}
      <SubjectDialogs dialog={dialog} onClose={() => setDialog(null)} onChanged={changed} />
      <UploadTray items={files.uploads.items} onRetry={files.uploads.retry} onDismiss={files.uploads.dismiss} />
    </Page>
  );
}

// Keyed by the subject, so moving to another subject starts with clean state: its own tab data,
// dialogs, and no upload queue left over from the last one.
export default function SubjectPage() {
  const { subjectId } = useParams();
  return <SubjectView key={subjectId} subjectId={subjectId} />;
}
