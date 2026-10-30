import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ClipboardList, Ellipsis, FileUp, Pencil, Trash2 } from "lucide-react";
import AppShell, { ShellOverlays } from "../components/layout/AppShell";
import PageSkeleton from "../components/layout/PageSkeleton";
import PageHeader from "../components/PageHeader";
import Tabs from "../components/Tabs";
import QuickAddTask from "../components/QuickAddTask";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import Menu, { MenuItem } from "../components/schedule/Menu";
import TaskModal from "../components/schedule/TaskModal";
import TaskRow from "../components/schedule/TaskRow";
import SubjectDialog from "../components/subject/SubjectDialog";
import SubjectDot from "../components/subject/SubjectDot";
import SubjectClasses from "../components/subject/SubjectClasses";
import SubjectReviewerRows from "../components/subject/SubjectReviewerRows";
import NotFound from "./NotFound";
import { useAuth } from "./authentication/AuthContext";
import useWorkload from "../utils/useWorkload";
import useEnteringIds from "../utils/useEnteringIds";
import { useTabParam } from "../utils/useTabParam";
import { saveTaskRequest } from "../utils/taskApi";
import { showDoneToast, focusTaskCheck } from "../utils/taskDone";
import { classesThisWeek } from "../utils/subjectClasses";
import { subjectMeta } from "../utils/subjectColors";
import { deleteSubjectRequest, fetchMainSchedule, fetchReviewerList, fetchSubject } from "../utils/subjectApi";
import { SUBJECT_TOUR } from "../utils/tours";
import "../App.css";
import "../styles/pages/subjects.css";

const TAB_IDS = ["overview", "tasks", "reviewers"];
const NEXT_UP_MAX = 5;

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// One subject: what is next, this week's classes, and its tasks and reviewers. A subject that is gone, or
// belongs to someone else, answers 404 and shows the app's not-found page.
export default function SubjectDetail() {
  const { id } = useParams();
  const { backendUrl } = useAuth();
  const navigate = useNavigate();
  const work = useWorkload();
  const { tasks, setTasks, now } = work;
  const [tab, setTab] = useTabParam(TAB_IDS);

  const [subject, setSubject] = useState(null);
  const [problem, setProblem] = useState(null); // { missing: true } or { message }
  const [reviewers, setReviewers] = useState(null);
  const [entries, setEntries] = useState(null);
  const [taskFilter, setTaskFilter] = useState("open");
  const [taskModal, setTaskModal] = useState(null); // { task?, draft? }
  const [deletingTask, setDeletingTask] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    const { data, error, status } = await fetchSubject(backendUrl, id);
    if (data) {
      setSubject(data.subject);
      setProblem(null);
    } else {
      setProblem(status === 404 ? { missing: true } : { message: error });
    }
  }, [backendUrl, id]);

  useEffect(() => {
    setSubject(null);
    setProblem(null);
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchReviewerList(backendUrl), fetchMainSchedule(backendUrl)]).then(([list, main]) => {
      if (cancelled) return;
      setReviewers(list.data?.reviewers ?? []);
      setEntries(main.data?.schedule?.entries ?? []);
    });
    return () => { cancelled = true; };
  }, [backendUrl]);

  const mine = useMemo(() => tasks.filter((t) => t.subject === id), [tasks, id]);
  const open = useMemo(() => mine.filter((t) => !t.isCompleted).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)), [mine]);
  const done = useMemo(() => mine.filter((t) => t.isCompleted).sort((a, b) => new Date(b.updatedAt || b.dueDate) - new Date(a.updatedAt || a.dueDate)), [mine]);
  const myReviewers = useMemo(
    () => (reviewers ?? []).filter((r) => r.subject === id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [reviewers, id],
  );
  const classes = useMemo(() => (subject && entries ? classesThisWeek(entries, subject, now) : []), [entries, subject, now]);
  const shown = taskFilter === "open" ? open : done;
  const entering = useEnteringIds(shown.map((t) => t._id));

  if (problem?.missing) return <NotFound />;
  if (problem) {
    return (
      <AppShell mainClassName="subject-page">
        <div className="panel reviewer-message">
          <p>{problem.message}</p>
          <button type="button" className="secondary-button" onClick={load}>Try again</button>
        </div>
      </AppShell>
    );
  }
  if (!subject || work.loading) return <AppShell mainClassName="subject-page"><PageSkeleton label="Loading this subject" /></AppShell>;

  // ---- Tasks: tick off, edit, delete (the same actions as Today) ----
  const completeTask = async (task, isDone) => {
    const ok = await work.updateTask(task._id, { isCompleted: isDone });
    if (ok) showDoneToast(isDone, async () => { if (await work.updateTask(task._id, { isCompleted: false })) focusTaskCheck(task._id); });
    return ok;
  };
  const saveTask = async (payload) => {
    const edited = taskModal?.task;
    const { task, error } = await saveTaskRequest(backendUrl, payload, edited?._id);
    if (error) return error;
    setTasks((list) => (edited ? list.map((t) => (t._id === edited._id ? task : t)) : [...list, task]));
    setTaskModal(null);
    toast.success(edited ? "Task saved." : "Added.");
    return undefined;
  };
  const toggleModalTaskDone = async () => {
    const task = taskModal?.task;
    if (!task) return;
    const ok = await work.updateTask(task._id, { isCompleted: !task.isCompleted });
    if (!ok) return;
    setTaskModal(null);
    showDoneToast(!task.isCompleted, () => work.updateTask(task._id, { isCompleted: task.isCompleted }));
  };
  const confirmTaskDelete = async () => {
    const task = deletingTask;
    setDeletingTask(null);
    if (await work.deleteTask(task._id)) {
      setTaskModal(null);
      toast.success("Task deleted.");
    }
  };

  const addTask = (task) => setTasks((list) => [...list, task]);
  const moreDetails = (draft) => setTaskModal({ draft: { ...draft, subject: id } });

  const leaveToSubjects = () => navigate("/study?tab=subjects", { replace: true });
  const removeSubject = async () => {
    const { error } = await deleteSubjectRequest(backendUrl, id);
    setConfirmDelete(false);
    if (error) return toast.error(error);
    toast.success("Subject deleted.");
    return leaveToSubjects();
  };
  // A rename relabels the subject's tasks on the server, so fetch them again.
  const saved = ({ subject: next }) => {
    setSubject(next);
    setEditing(false);
    work.refreshTasks();
  };

  const row = (task) => (
    <TaskRow key={task._id} task={task} subject={subject} now={now} entering={entering.has(task._id)} onSetDone={completeTask} onEdit={(t) => setTaskModal({ task: t })} />
  );
  const quickAdd = (props) => (
    <QuickAddTask flat tour="subj-quick" subject={id} onAdded={addTask} onMoreDetails={moreDetails} {...props} />
  );
  const noTasks = (
    <EmptyState compact icon={ClipboardList} title="No open tasks">
      Add one above and it's filed under {subject.name}.
    </EmptyState>
  );
  const noReviewers = (
    <EmptyState compact icon={FileUp} title="No reviewers yet">
      Upload a PDF on Study and choose this subject, and it shows up here.
    </EmptyState>
  );

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: "Tasks", count: open.length },
    { id: "reviewers", label: "Reviewers", count: myReviewers.length },
  ];
  const description = [subjectMeta(subject), plural(open.length, "open task")].filter(Boolean).join(" · ");

  return (
    <AppShell mainClassName="subject-page" tour={{ page: "subject", title: "Subject", steps: SUBJECT_TOUR }}>
      <PageHeader
        title={<><SubjectDot color={subject.color} /><span className="subject-title-text">{subject.name}</span></>}
        description={description}
        back={{ to: "/study?tab=subjects", label: "Subjects" }}
        actions={(
          <div className="subject-head-actions" data-tour="subj-head">
            <button type="button" className="secondary-button" onClick={() => setEditing(true)}>
              <Pencil size={16} aria-hidden="true" /> Edit
            </button>
            <Menu trigger={<><Ellipsis size={18} aria-hidden="true" /> More</>} className="secondary-button">
              {(close) => (
                <MenuItem icon={Trash2} tone="danger" onClick={() => { close(); setConfirmDelete(true); }}>Delete</MenuItem>
              )}
            </Menu>
          </div>
        )}
      />

      <div data-tour="subj-tabs">
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Subject sections" />
      </div>

      {tab === "overview" && (
        <div className="subject-overview" role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
          <section className="panel subject-card" aria-labelledby="subject-next-title">
            <h2 id="subject-next-title">Next up</h2>
            {quickAdd({ collapsible: true, defaultOpen: open.length === 0 })}
            {open.length === 0 ? noTasks : (
              <>
                <ul className="task-rows stagger">{open.slice(0, NEXT_UP_MAX).map(row)}</ul>
                {open.length > NEXT_UP_MAX && (
                  <button type="button" className="ghost-button subject-more" onClick={() => setTab("tasks")}>
                    See all {open.length} tasks
                  </button>
                )}
              </>
            )}
          </section>

          <div className="subject-side">
            <SubjectClasses classes={classes} loaded={entries !== null} />
            <section className="panel subject-card" aria-labelledby="subject-reviewer-title">
              <h2 id="subject-reviewer-title">Latest reviewer</h2>
              {myReviewers.length === 0 ? noReviewers : <SubjectReviewerRows reviewers={myReviewers.slice(0, 1)} />}
            </section>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <section className="panel subject-card" role="tabpanel" id="panel-tasks" aria-labelledby="tab-tasks">
          {quickAdd()}
          <div className="subject-toolbar">
            <div className="segmented" role="group" aria-label="Show">
              <button type="button" className={`segmented-option${taskFilter === "open" ? " is-selected" : ""}`} aria-pressed={taskFilter === "open"} onClick={() => setTaskFilter("open")}>Open ({open.length})</button>
              <button type="button" className={`segmented-option${taskFilter === "done" ? " is-selected" : ""}`} aria-pressed={taskFilter === "done"} onClick={() => setTaskFilter("done")}>Done ({done.length})</button>
            </div>
          </div>
          {shown.length === 0
            ? (taskFilter === "open" ? noTasks : <p className="task-list-empty">Finished tasks show up here.</p>)
            : <ul className="task-rows stagger">{shown.map(row)}</ul>}
        </section>
      )}

      {tab === "reviewers" && (
        <div role="tabpanel" id="panel-reviewers" aria-labelledby="tab-reviewers">
          {reviewers === null ? (
            <div className="panel reviewer-message"><p>Loading your reviewers...</p></div>
          ) : myReviewers.length === 0 ? (
            <section className="panel subject-card">{noReviewers}</section>
          ) : (
            <SubjectReviewerRows reviewers={myReviewers} />
          )}
        </div>
      )}

      <ShellOverlays>
        {editing && <SubjectDialog subject={subject} onClose={() => setEditing(false)} onSaved={saved} onDeleted={leaveToSubjects} />}
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete ${subject.name}?`}
          confirmLabel="Delete"
          tone="danger"
          onConfirm={removeSubject}
          onCancel={() => setConfirmDelete(false)}
        >
          Your tasks and reviewers for it stay, with the class name as a plain label. They just won't be grouped under this subject anymore.
        </ConfirmDialog>
        {taskModal && (
          <TaskModal
            task={taskModal.task}
            draft={taskModal.draft}
            onSave={saveTask}
            onDelete={taskModal.task ? () => setDeletingTask(taskModal.task) : undefined}
            onToggleDone={taskModal.task ? toggleModalTaskDone : undefined}
            onClose={() => setTaskModal(null)}
          />
        )}
        <ConfirmDialog
          open={Boolean(deletingTask)}
          title="Delete this task?"
          confirmLabel="Delete task"
          tone="danger"
          onConfirm={confirmTaskDelete}
          onCancel={() => setDeletingTask(null)}
        >
          {deletingTask ? `"${deletingTask.title}" will be removed from your plan.` : ""}
        </ConfirmDialog>
      </ShellOverlays>
    </AppShell>
  );
}
