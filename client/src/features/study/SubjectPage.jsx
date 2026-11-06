import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FileQuestion } from "lucide-react";
import { Button, Chip, EmptyState, Skeleton, Tabs } from "@/shared/ui";
import Page from "@/app/shell/Page";
import NewTaskDialog from "@/features/tasks/NewTaskDialog";
import useTaskDone from "@/features/tasks/useTaskDone";
import useNow from "@/shared/hooks/useNow";
import { subjectMeta } from "@/utils/subjectColors";
import ClassSchedule from "./ClassSchedule";
import NewReviewerDialog from "./NewReviewerDialog";
import NextUpList from "./NextUpList";
import PickUpCard from "./PickUpCard";
import SubjectCounts from "./SubjectCounts";
import SubjectDialogs from "./SubjectDialogs";
import SubjectMenu from "./SubjectMenu";
import SubjectReviewers from "./SubjectReviewers";
import SubjectTasks from "./SubjectTasks";
import { classesThisWeek, examChipText, upcomingEntries } from "./subjectClasses";
import useReviewers from "./useReviewers";
import useSubject from "./useSubject";
import "./subject.css";

const BACK = { to: "/study", label: "Back to Study" };
const TAB_VALUES = ["overview", "tasks", "reviewers"];

// Overview is the bare path; the others add ?tab=. Each tab is a history step, so Back returns to
// the tab the student was on.
const tabPath = (id, tab) => `/study/subjects/${id}${tab === "overview" ? "" : `?tab=${tab}`}`;

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

// One subject (Figma 76:878): its code and term with an exam chip, then three tabs picked by
// ?tab= (an unknown value shows Overview). Overview is the frame: Next up and Pick up on the left,
// Class schedule and counts on the right (one column on phones). Tasks and Reviewers are built from
// the shared pieces and aren't in the frame. Notes, Practice and Files aren't here. The header More
// menu edits or deletes the subject (deleting returns to Study). An unknown or foreign id shows
// "Subject not found".
export default function SubjectPage() {
  const { subjectId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const now = useNow();
  const [dialog, setDialog] = useState(null); // edit or delete: { type, subject }
  const [adding, setAdding] = useState(null); // "task" | "reviewer"
  const data = useSubject(subjectId);
  const { reviewers: allReviewers, limits, refresh: refreshReviewers } = useReviewers();
  const { subject, status } = data;
  const setDone = useTaskDone(data.setTasks);
  const tab = TAB_VALUES.includes(params.get("tab")) ? params.get("tab") : "overview";
  const reviewers = allReviewers && allReviewers.filter((r) => r.subject === subjectId);

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
    </Page>
  );
}
