import { useParams } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { Button, Chip, EmptyState, Skeleton, Tabs } from "@/shared/ui";
import Page from "@/app/shell/Page";
import useTaskDone from "@/features/tasks/useTaskDone";
import useNow from "@/shared/hooks/useNow";
import { subjectMeta } from "@/utils/subjectColors";
import ClassSchedule from "./ClassSchedule";
import NextUpList from "./NextUpList";
import PickUpCard from "./PickUpCard";
import SubjectCounts from "./SubjectCounts";
import { classesThisWeek, examChipText, upcomingEntries } from "./subjectClasses";
import useSubject from "./useSubject";
import "./subject.css";

const BACK = { to: "/study", label: "Back to Study" };
const TABS = [{ value: "overview", label: "Overview", id: "subject-tab-overview", panelId: "subject-panel" }];

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

// One subject (Figma 76:878): its code and term with an exam chip, then Next up and Pick up on the
// left and Class schedule and counts on the right (one column on phones). Only Overview is built:
// Notes and Materials have no backend and Practice isn't drawn. The More menu (edit, delete) isn't
// in the frame, so it isn't here either. An unknown or foreign id shows "Subject not found".
export default function SubjectPage() {
  const { subjectId } = useParams();
  const now = useNow();
  const data = useSubject(subjectId);
  const { subject, status } = data;
  const setDone = useTaskDone(data.setTasks);

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

  return (
    <Page title={subject.name} back={BACK}>
      <div className="subject-body">
        {(meta || exam) && (
          <p className="subject-meta">
            {meta && <span>{meta}</span>}
            {exam && <Chip tone="watch">{exam}</Chip>}
          </p>
        )}
        <Tabs items={TABS} value="overview" label="Subject sections" className="subject-tabs" />
        <div className="subject-columns" role="tabpanel" id="subject-panel" aria-labelledby="subject-tab-overview">
          <div className="subject-column">
            <NextUpList
              tasks={data.tasks}
              upcoming={upcomingEntries(data.entries, subject, now)}
              now={now}
              onToggle={setDone}
            />
            <PickUpCard reviewers={data.reviewers} now={now} />
          </div>
          <div className="subject-column">
            <ClassSchedule classes={classesThisWeek(data.entries, subject, now)} />
            <SubjectCounts openTasks={data.tasks.length} reviewers={data.reviewers.length} />
          </div>
        </div>
      </div>
    </Page>
  );
}
