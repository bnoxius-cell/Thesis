import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import AppShell, { ShellOverlays } from "../components/layout/AppShell";
import PageSkeleton from "../components/layout/PageSkeleton";
import WorkloadChart from "../components/WorkloadChart";
import PSSSurveyModal from "../components/PSSSurveyModal";
import WHOSurveyModal from "../components/WHOSurveyModal";
import CheckInBanner from "../components/CheckInBanner";
import ConfirmDialog from "../components/ConfirmDialog";
import QuickAddTask from "../components/QuickAddTask";
import TaskModal from "../components/schedule/TaskModal";
import EmptyState from "../components/EmptyState";
import SetupChecklist, { setupState } from "../components/today/SetupChecklist";
import NextStepCard from "../components/today/NextStepCard";
import WeekCard from "../components/today/WeekCard";
import TodayCard from "../components/today/TodayCard";
import ComingUp from "../components/today/ComingUp";
import WeekProgress from "../components/today/WeekProgress";
import TodayLayout from "../components/today/TodayLayout";
import { TODAY_MAX_ROWS } from "../components/today/TodayCard";
import { DASHBOARD_TOUR } from "../utils/tours";
import { Sprout } from "lucide-react";
import useWorkload from "../utils/useWorkload";
import { useAuth } from "./authentication/AuthContext";
import { finishedThisWeek } from "../utils/doneThisWeek";
import { toWeekReading } from "../utils/weekReading";
import { saveTaskRequest } from "../utils/taskApi";
import { showDoneToast } from "../utils/taskDone";
import "../styles/pages/today.css";

// "Tuesday, Sep 29. 2 classes left today and 2 tasks due soon."
function summarizeDay(day, focus) {
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const isClass = (e) => e.kind === "class";
  const left = [...focus.happeningNow, ...focus.laterToday].filter(isClass).length;
  const total = day.entries.filter(isClass).length;
  const bits = [];
  if (day.holiday) bits.push(`a day off for ${day.holiday}`);
  else if (left) bits.push(`${left} ${left === 1 ? "class" : "classes"} ${left === total ? "today" : "left today"}`);
  else if (total) bits.push("classes are done for today");
  const due = focus.dueSoon.length;
  if (due) bits.push(`${due} ${due === 1 ? "task" : "tasks"} due soon`);
  const sentence = bits.join(" and ");
  return bits.length ? `${date}. ${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.` : `${date}. Nothing pressing today.`;
}

// The greeting and the "Today" card read the same clock (phaseFor in todayFocus.js).
const GREETING = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good evening" };

const SETUP_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const COMING_UP_DAYS = 7;

const Dashboard = () => {
  const work = useWorkload();
  const { backendUrl } = useAuth();
  const [showPSSModal, setShowPSSModal] = useState(false);
  const [showWHOModal, setShowWHOModal] = useState(false);
  const [setupHidden, setSetupHidden] = useState(null);
  const [taskModal, setTaskModal] = useState(null); // { task?, draft? }
  const [deleting, setDeleting] = useState(null);
  const [addedOne, setAddedOne] = useState(false); // the layout can swap after a first task; keep the cursor in quick add

  if (!work.isLoggedin) return <AppShell variant="public"><p>Please log in to view your dashboard.</p></AppShell>;
  if (work.loading || !work.userData) return <AppShell><PageSkeleton label="Loading your day" /></AppShell>;

  const { insights, today, focus, nextExam, hasSchedule, week, userId, profile, now } = work;
  const doneCount = finishedThisWeek(work.tasks, now).length;
  const firstName = profile.studentName?.split(" ")[0];

  // Open tasks: due today or overdue go in the Today card, the next 7 days in Coming up.
  const todayTasks = work.enrichedTasks.filter((task) => task.daysLeft <= 0).sort((a, b) => a.daysLeft - b.daysLeft);
  const comingTasks = work.enrichedTasks
    .filter((task) => task.daysLeft >= 1 && task.daysLeft <= COMING_UP_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft || b.workload - a.workload);

  const setup = setupState({ userData: work.userData, hasSchedule, taskCount: work.tasks.length, profile });
  const createdAt = work.userData.createdAt ? new Date(work.userData.createdAt).getTime() : 0;
  const recentAccount = createdAt > 0 && now.getTime() - createdAt < SETUP_WINDOW_MS;
  const hideSetup = setupHidden ?? setup.hidden;
  const showSetup = !setup.complete && !hideSetup && (insights.isNewUser || recentAccount);

  const hideSetupCard = () => {
    try { localStorage.setItem(`stresscare:setup-hidden:${userId}`, "1"); } catch { /* private mode */ }
    setSetupHidden(true);
  };

  // ---- Tasks: quick add, tick off, edit ----
  const addTask = (task) => { setAddedOne(true); work.setTasks((list) => [...list, task]); };
  const completeTask = async (task, done) => {
    const ok = await work.updateTask(task._id, { isCompleted: done });
    if (ok) showDoneToast(done, () => work.updateTask(task._id, { isCompleted: false }));
    return ok;
  };
  const saveTask = async (payload) => {
    const editing = taskModal?.task;
    const { task, error } = await saveTaskRequest(backendUrl, payload, editing?._id);
    if (error) return error;
    work.setTasks((list) => (editing ? list.map((t) => (t._id === editing._id ? task : t)) : [...list, task]));
    setTaskModal(null);
    toast.success(editing ? "Task saved." : "Added.");
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
  const confirmDelete = async () => {
    const task = deleting;
    setDeleting(null);
    if (await work.deleteTask(task._id)) {
      setTaskModal(null);
      toast.success("Task deleted.");
    }
  };
  const courses = [...new Set([
    ...work.tasks.map((t) => t.course),
    ...work.week.flatMap((d) => d.entries.filter((e) => e.kind === "class").map((e) => e.title)),
  ].filter(Boolean))];

  const todayEntryCount = focus.happeningNow.length + focus.laterToday.length;
  const reading = toWeekReading({ insights, plannedTasks: work.plannedTasks, now });

  const quickAdd = (
    <QuickAddTask tour="dash-quick" focusOnMount={addedOne} onAdded={addTask} onMoreDetails={(draft) => setTaskModal({ draft })} />
  );

  const checkIn = (
    <CheckInBanner
      isOpen
      pssDue={work.pssDue}
      whoDue={work.whoDue}
      onSelectPSS={() => setShowPSSModal(true)}
      onSelectWHO={() => setShowWHOModal(true)}
      onDismiss={() => {
        work.snooze(...[work.pssDue && "PSS", work.whoDue && "WHO"].filter(Boolean));
        // The notice unmounts with the focused button, so put focus on the page instead of <body>.
        document.getElementById("main")?.focus({ preventScroll: true });
      }}
    />
  );

  return (
    <AppShell tour={{ page: "dashboard", title: "Today", steps: DASHBOARD_TOUR }}>
        <section className="today-head" id="dashboard" data-tour="dash-greeting">
          <div>
            <h1>{GREETING[focus.phase]}{firstName ? `, ${firstName}` : ""}.</h1>
            <p>{insights.isNewUser ? "Here's your space. Let's get it set up." : summarizeDay(today, focus)}</p>
          </div>
        </section>

        {insights.isNewUser ? (
          <div className="today-stack">
            {quickAdd}
            {showSetup ? (
              <SetupChecklist work={work} setup={setup} onStartCheckIn={() => setShowPSSModal(true)} onHide={hideSetupCard} />
            ) : (
              <section className="panel">
                <EmptyState icon={Sprout} title="Nothing here yet">
                  Add a task above, or your classes, and your week starts to take shape.
                  <span className="empty-state-actions">
                    <Link to="/schedule" className="secondary-button">Open schedule</Link>
                  </span>
                </EmptyState>
              </section>
            )}
            {checkIn}
          </div>
        ) : (
          <TodayLayout
            sizes={{
              todayRows: Math.min(TODAY_MAX_ROWS, todayEntryCount + todayTasks.length),
              comingRows: Math.min(5, comingTasks.length),
              nextHeight: showSetup ? 420 : 220,
              hasNotice: work.pssDue || work.whoDue,
            }}
            week={<WeekCard reading={reading} />}
            quick={quickAdd}
            today={(
              <TodayCard
                focus={focus} today={today} tasks={todayTasks} now={now} nextExam={nextExam} hasSchedule={hasSchedule}
                onComplete={completeTask} onEdit={(task) => setTaskModal({ task })}
              />
            )}
            coming={<ComingUp tasks={comingTasks} now={now} onComplete={completeTask} onEdit={(task) => setTaskModal({ task })} />}
            next={showSetup ? (
              <SetupChecklist work={work} setup={setup} onStartCheckIn={() => setShowPSSModal(true)} onHide={hideSetupCard} />
            ) : (
              <NextStepCard work={work} />
            )}
            strip={(
              <section className="panel week-strip" data-tour="dash-week" aria-labelledby="week-strip-title">
                <h2 id="week-strip-title">The next 7 days</h2>
                <Link to="/wellbeing#week" className="week-strip-link" aria-label="See your week in detail">
                  <WorkloadChart schedule={week} hasSchedule={hasSchedule} compact />
                </Link>
                <WeekProgress tasks={work.tasks} now={now} />
                {doneCount > 0 && (
                  <p className="today-quiet">
                    {doneCount === 1 ? "You finished 1 task in the last 7 days." : `You finished ${doneCount} tasks in the last 7 days.`} That counts.
                  </p>
                )}
              </section>
            )}
            notice={checkIn}
          />
        )}
      <ShellOverlays>
        {taskModal && (
          <TaskModal
            task={taskModal.task}
            draft={taskModal.draft}
            courses={courses}
            onSave={saveTask}
            onDelete={taskModal.task ? () => setDeleting(taskModal.task) : undefined}
            onToggleDone={taskModal.task ? toggleModalTaskDone : undefined}
            onClose={() => setTaskModal(null)}
          />
        )}
        <ConfirmDialog
          open={Boolean(deleting)}
          title="Delete this task?"
          confirmLabel="Delete task"
          tone="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        >
          {deleting ? `"${deleting.title}" will be removed from your plan.` : ""}
        </ConfirmDialog>
        {/* Mounted only while open, so each one starts from a clean slate. */}
        {showPSSModal && (
          <PSSSurveyModal
            isFirstTime={work.pssNeverTaken}
            onClose={() => setShowPSSModal(false)}
            onComplete={() => { setShowPSSModal(false); work.refreshUser(); }}
            onRemindLater={() => { work.snooze("PSS"); setShowPSSModal(false); }}
          />
        )}

        {showWHOModal && (
          <WHOSurveyModal
            isFirstTime={work.whoNeverTaken}
            onClose={() => setShowWHOModal(false)}
            onComplete={() => { setShowWHOModal(false); work.refreshUser(); }}
            onRemindLater={() => { work.snooze("WHO"); setShowWHOModal(false); }}
          />
        )}
      </ShellOverlays>
    </AppShell>
  );
};

export default Dashboard;
