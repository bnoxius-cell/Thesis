import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./authentication/AuthContext";
import axios from "axios";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import WorkloadChart from "../components/WorkloadChart";
import TaskBoard from "../components/TaskBoard";
import PSSSurveyModal from "../components/PSSSurveyModal";
import WHOSurveyModal from "../components/WHOSurveyModal";
import CheckInBanner from "../components/CheckInBanner";
import TaskImportDialog from "../components/TaskImportDialog";
import { AlertTriangle, Eye, Lightbulb, Sparkles, CalendarDays, MapPin } from "lucide-react";
import { toISODate, formatTime } from "../utils/scheduleUtils";
import { buildWeek, computeWorkload, getTaskMetrics } from "../utils/workload";
import useCountUp from "../utils/useCountUp";
import "../App.css";

// New accounts get a quiet first day: no survey nudge fires until this much
// time has passed since registration. Accounts from before this feature
// shipped have no createdAt on record, so they fall back to the old
// immediate-reminder behavior instead of silently getting a permanent grace
// period.
const ONBOARDING_GRACE_MS = 24 * 60 * 60 * 1000;

function isWithinGracePeriod(createdAt) {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < ONBOARDING_GRACE_MS;
}

function CountUp({ value }) {
  return useCountUp(value);
}

// "Tuesday, Sep 29. 3 classes today and 2 tasks due soon."
function summarizeDay(day, dueCount) {
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const classes = day.entries.filter((e) => e.kind === "class").length;
  const bits = [];
  if (day.holiday) bits.push(`a day off for ${day.holiday}`);
  else if (classes) bits.push(`${classes} ${classes === 1 ? "class" : "classes"} today`);
  if (dueCount) bits.push(`${dueCount} ${dueCount === 1 ? "task" : "tasks"} due soon`);
  return bits.length ? `${date}. ${bits.join(" and ")}.` : `${date}. Nothing pressing today.`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Maps a workload band to a calm severity scale for the "how you're doing"
// visual, sage (fine) through clay (a lot), instead of a raw percentage.
const BAND_SEVERITY = {
  "Light Workload": "calm",
  "Moderate Workload": "steady",
  "Heavy Workload": "full",
  "Critical Overload": "a-lot",
};

// Words first, numbers second. How the workload band actually feels,
// not just what it measures.
const WELLBEING_MESSAGE = {
  "Light Workload": "This week is looking manageable. You're in a good spot.",
  "Moderate Workload": "You've got a fair amount going on, but it's steady.",
  "Heavy Workload": "Your plate is fuller than usual, so it's worth pacing yourself this week.",
  "Critical Overload": "This is a lot right now. Be gentle with yourself, and lean on a friend if you need to.",
};

const LEVEL_WORD = { low: "Light", moderate: "Steady", high: "Heavy" };
const TIP_ICON = { alert: AlertTriangle, watch: Eye, info: Lightbulb, good: Sparkles };

const Dashboard = () => {
  const { backendUrl, isLoggedin } = useAuth();
  const [profile, setProfile] = useState({
    studentName: "",
    program: "BS Information Technology",
    studyHoursPerDay: 4,
    wellbeingGoal: "steady",
  });
  const [tasks, setTasks] = useState([]);
  // The next seven days of the user's timetable, from /api/schedules/week. Stays null
  // if the request fails, which the workload treats the same as having no timetable.
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importCode, setImportCode] = useState("");
  const [importTag, setImportTag] = useState(null); // 6-digit code being previewed
  const [taskMessage, setTaskMessage] = useState("");

  // Survey states
  const [showPSSModal, setShowPSSModal] = useState(false);
  const [showWHOModal, setShowWHOModal] = useState(false);
  const [pssDue, setPssDue] = useState(false);
  const [whoDue, setWhoDue] = useState(false);
  const [pssNeverTaken, setPssNeverTaken] = useState(false);
  const [whoNeverTaken, setWhoNeverTaken] = useState(false);
  const [surveyUserId, setSurveyUserId] = useState("");
  const [pssScore, setPssScore] = useState(null);
  const [whoScore, setWhoScore] = useState(null);
  const [isExamWeek] = useState(false);

  // Reminder helpers
  const getReminderKey = (type, userId = surveyUserId) => `remind${type}Until:${userId || "anonymous"}`;
  const getReminder = (type, userId) => {
    const until = localStorage.getItem(getReminderKey(type, userId));
    return until ? parseInt(until) : 0;
  };
  // "Not today" snoozes until tomorrow rather than a nagging 30-minute
  // countdown that would just resurface the check-in again the same afternoon.
  const setReminder = (type) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    localStorage.setItem(getReminderKey(type), tomorrow.getTime());
  };


  const fetchProfile = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/user/data`, { withCredentials: true });
      if (data.success && data.userData) {
        const u = data.userData;
        setSurveyUserId(u._id || "");
        setProfile(prev => ({
          ...prev,
          studentName: u.name || "",
          program: u.program || "BS Information Technology",
          studyHoursPerDay: u.studyHoursPerDay || 4,
          wellbeingGoal: u.wellbeingGoal || "steady",
        }));
        setPssScore(u.latestPSSScore ?? null);
        setWhoScore(u.latestWHOScore ?? null);
        setPssNeverTaken(!u.lastPSSSubmission);
        setWhoNeverTaken(!u.lastWHOSubmission);
        // For exam week, you would read from profile later
        // setIsExamWeek(u.isExamWeek || false);

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const pssReminder = getReminder("PSS", u._id);
        const whoReminder = getReminder("WHO", u._id);
        const inGracePeriod = isWithinGracePeriod(u.createdAt);

        let nextPssDue = false, nextWhoDue = false;

        if (Date.now() >= pssReminder) {
          if (!u.lastPSSSubmission) {
            // Never taken: hold off during the new-account grace period
            // instead of nagging on day one.
            nextPssDue = !inGracePeriod;
          } else {
            const last = new Date(u.lastPSSSubmission);
            last.setHours(0, 0, 0, 0);
            const daysSince = (now - last) / (1000 * 60 * 60 * 24);
            if (daysSince >= 30) nextPssDue = true;
          }
        }

        if (Date.now() >= whoReminder) {
          if (!u.lastWHOSubmission) {
            nextWhoDue = !inGracePeriod;
          } else {
            const last = new Date(u.lastWHOSubmission);
            last.setHours(0, 0, 0, 0);
            const daysSince = (now - last) / (1000 * 60 * 60 * 24);
            if (daysSince >= 14) nextWhoDue = true;
          }
        }

        setPssDue(nextPssDue);
        setWhoDue(nextWhoDue);
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/tasks`, { withCredentials: true });
      if (data.success) setTasks(data.tasks);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    }
  };

  const fetchOverview = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/schedules/week`, {
        params: { start: toISODate(new Date()) },
        withCredentials: true,
      });
      if (data.success) setOverview(data);
    } catch (err) {
      console.error("Failed to fetch schedule overview", err);
    }
  };

  useEffect(() => {
    if (isLoggedin) {
      Promise.all([fetchProfile(), fetchTasks(), fetchOverview()]).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isLoggedin]);

  // Coming back from the Schedule page (or another tab) should show the new timetable.
  useEffect(() => {
    if (!isLoggedin) return undefined;
    const refresh = () => { if (!document.hidden) fetchOverview(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [isLoggedin]);

  // Task handlers
  const handleDeleteTask = async (taskId) => {
    try {
      const { data } = await axios.delete(`${backendUrl}/api/tasks/${taskId}`, { withCredentials: true });
      if (data.success) setTasks(prev => prev.filter(t => t._id !== taskId));
    } catch (err) { console.error("Delete error", err); }
  };

  const updateTask = async (taskId, updatedFields) => {
    try {
      const { data } = await axios.put(`${backendUrl}/api/tasks/${taskId}`, updatedFields, { withCredentials: true });
      if (data.success) setTasks(prev => prev.map(t => t._id === taskId ? data.task : t));
    } catch (err) { console.error("Update failed", err); }
  };

  const markTaskDone = async (taskId) => await updateTask(taskId, { isCompleted: true });

  // A code opens a preview (details, whether you already have it, what else is due that
  // day) instead of adding straight away.
  const importTaskByCode = (code) => {
    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      setTaskMessage("Enter a valid 6-digit task code.");
      return;
    }
    setTaskMessage("");
    setImportTag(normalizedCode);
  };

  const importTask = async (e) => {
    e.preventDefault();
    await importTaskByCode(importCode);
  };

  const handleImportCodeChange = (value) => {
    setImportCode(value.replace(/\D/g, "").slice(0, 6));
  };

  const handleImportCodePaste = (e) => {
    const pastedCode = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (/^\d{6}$/.test(pastedCode)) {
      e.preventDefault();
      setImportCode(pastedCode);
      importTaskByCode(pastedCode);
    }
  };

  if (!isLoggedin) return <div className="app auth-layout"><Header /><main className="dashboard"><p>Please log in to view your dashboard.</p></main><Footer /></div>;
  if (loading) return <div className="app app-layout"><Header /><main className="dashboard"><div className="panel" style={{ textAlign: "center" }}><p>Loading dashboard...</p></div></main><Footer /></div>;

  const activeTasks = tasks.filter(task => !task.isCompleted);
  const enrichedTasks = activeTasks.map(task => ({ ...task, ...getTaskMetrics(task) })).sort((a,b) => b.workload - a.workload);
  const hasSchedule = Boolean(overview?.scheduleCount && overview?.entryCount);
  const week = buildWeek(activeTasks, profile, overview);
  const workloadInsights = computeWorkload({ tasks: activeTasks, profile, days: week, pssScore, whoScore, isExamWeek, hasSchedule });
  const todayTasks = enrichedTasks.filter(t => t.daysLeft <= 1).slice(0, 5);
  const today = week[0];
  const firstName = profile.studentName?.split(" ")[0];

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <CheckInBanner
          isOpen
          pssDue={pssDue}
          whoDue={whoDue}
          onSelectPSS={() => setShowPSSModal(true)}
          onSelectWHO={() => setShowWHOModal(true)}
          onDismiss={() => {
            if (pssDue) setReminder("PSS");
            if (whoDue) setReminder("WHO");
            fetchProfile();
          }}
        />

        <section className="greeting" id="dashboard">
          <h1>{getGreeting()}{firstName ? `, ${firstName}` : ""}.</h1>
          <p>{workloadInsights.isNewUser ? "Here's your space. Let's get it set up." : summarizeDay(today, todayTasks.length)}</p>
        </section>

        {workloadInsights.isNewUser ? (
          <section className="hero welcome-hero">
            <div className="hero-copy">
              <span className="panel-kicker">Getting started</span>
              <h2>Add your first task</h2>
              <p>StressCare turns your deadlines and your class schedule into a realistic weekly plan and a gentle read on how you're doing, once there's something to work with.</p>
              <div className="welcome-actions">
                <Link to="/create-task" className="primary-button">+ Add your first task</Link>
                <Link to="/schedule" className="ghost-button"><CalendarDays size={16} aria-hidden="true" /> Add your class schedule</Link>
              </div>
              <p className="welcome-hint">Feel free to look around first. Nothing here needs to happen right away.</p>
            </div>
            <aside className="hero-panel welcome-panel">
              <h2>What you'll see here</h2>
              <ul className="hero-list">
                <li>What's on today: classes, activities and deadlines</li>
                <li>A weekly plan that works around your timetable</li>
                <li>A gentle read on how you're doing, in words rather than just numbers</li>
              </ul>
            </aside>
          </section>
        ) : (
          <section className="grid today-grid">
            <section className="panel">
              <div className="panel-heading"><div><span className="panel-kicker">Today</span><h2>What's in front of you</h2></div></div>

              {today.holiday && (
                <p className="today-holiday"><CalendarDays size={16} aria-hidden="true" /> {today.holiday}. Classes that skip holidays are off today.</p>
              )}

              {today.entries.length > 0 && (
                <ul className="today-list today-classes" aria-label="Classes and activities today">
                  {today.entries.map((entry, i) => (
                    <li key={`${entry.title}-${entry.startTime}-${i}`} className="today-item">
                      <span className={`today-dot ${entry.kind === "activity" ? "activity" : "class"}`} aria-hidden="true" />
                      <div>
                        <strong>{entry.title}</strong>
                        <span className="today-meta">
                          {formatTime(entry.startTime)} to {formatTime(entry.endTime)}
                          {entry.location && <> · <MapPin size={12} aria-hidden="true" /> {entry.location}</>}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {todayTasks.length > 0 ? (
                <>
                  {today.entries.length > 0 && <h3 className="today-subhead">Due soon</h3>}
                  <ul className="today-list">
                    {todayTasks.map((task) => (
                      <li key={task._id} className="today-item">
                        <span className={`today-dot ${task.status.toLowerCase().replace(/\s+/g, "-")}`} aria-hidden="true" />
                        <div>
                          <strong>{task.title}</strong>
                          <span className="today-meta">{task.course} · {task.daysLeft < 0 ? "overdue" : task.daysLeft === 0 ? "due today" : "due tomorrow"}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : today.entries.length === 0 && (
                <p className="today-empty">
                  {today.holiday ? "A day off, and nothing due. Enjoy it." : "Nothing on today and nothing due tomorrow. A good day to get ahead, or just breathe."}
                </p>
              )}

              <div className="today-actions">
                <Link to="/create-task" className="ghost-button today-add">+ Add a task</Link>
                <Link to="/schedule" className="ghost-button today-add"><CalendarDays size={16} aria-hidden="true" /> {hasSchedule ? "View schedule" : "Add your class schedule"}</Link>
              </div>
            </section>

            <aside className="hero-panel">
              <h2>How you're doing</h2>
              <div className={`stress-ring ${BAND_SEVERITY[workloadInsights.band]}`}>
                <div className="stress-ring-inner">
                  <strong>{workloadInsights.band}</strong>
                  <span className="stress-ring-score"><CountUp value={workloadInsights.workloadScore} /> / 100</span>
                </div>
              </div>
              <p>{WELLBEING_MESSAGE[workloadInsights.band]}</p>

              <ul className="driver-list" aria-label="What's shaping your workload">
                {workloadInsights.parts.map((part) => (
                  <li key={part.key} className={`driver driver-${part.level}`}>
                    <span className="driver-label">{part.label}</span>
                    <span className="driver-word">{LEVEL_WORD[part.level]}</span>
                    <span className="driver-track" aria-hidden="true"><span className="driver-fill" style={{ width: `${Math.max(part.value, 4)}%` }} /></span>
                  </li>
                ))}
              </ul>

              {!(pssScore !== null || whoScore !== null) && (
                <p className="welcome-hint">This gets more personal once you take a check-in.</p>
              )}
            </aside>
          </section>
        )}

        {!workloadInsights.isNewUser && (
          <section className="grid analytics-grid">
            <section className="panel">
              <div className="panel-heading"><div><span className="panel-kicker">This week</span><h2>How your week adds up</h2></div></div>
              <WorkloadChart schedule={week} hasSchedule={hasSchedule} />
            </section>
            <section className="panel insights-panel">
              <div className="panel-heading"><div><span className="panel-kicker">Guidance</span><h2>Where to focus</h2></div></div>
              <div className="insight-stack">
                {workloadInsights.tips.map((tip) => {
                  const Icon = TIP_ICON[tip.tone];
                  return (
                    <article className={`insight-card tone-${tip.tone}`} key={tip.title}>
                      <span className="insight-icon" aria-hidden="true"><Icon size={16} /></span>
                      <div>
                        <strong>{tip.title}</strong>
                        <p>{tip.text}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </section>
        )}

        <section className="panel">
          <div className="panel-heading"><div><span className="panel-kicker">All tasks</span><h2>Everything on your plate</h2></div></div>
          <form className="task-import-form" onSubmit={importTask}>
            <input type="text" inputMode="numeric" maxLength="6" value={importCode} onChange={(e) => handleImportCodeChange(e.target.value)} onPaste={handleImportCodePaste} placeholder="6-digit task tag" />
            <button type="submit" className="secondary-button">Import Task</button>
          </form>
          {taskMessage && <p className="task-message">{taskMessage}</p>}
          <TaskBoard tasks={enrichedTasks} schedule={week} onDeleteTask={handleDeleteTask} onEditTask={updateTask} onMarkDone={markTaskDone} />
        </section>
      </main>
      <Footer />

      {/* Mounted only while open, so each one starts from a clean slate
          (unanswered questions, no leftover "thanks for checking in" state)
          instead of needing an effect to reset it on reopen. */}
      {importTag && (
        <TaskImportDialog
          tag={importTag}
          onClose={() => setImportTag(null)}
          onImported={(task) => {
            setTasks(prev => [...prev, task]);
            setImportCode("");
            setTaskMessage("Task imported into your list.");
            setImportTag(null);
          }}
        />
      )}

      {showPSSModal && (
        <PSSSurveyModal
          isOpen={showPSSModal}
          isFirstTime={pssNeverTaken}
          onClose={() => setShowPSSModal(false)}
          onComplete={(newScore) => {
            setPssScore(newScore);
            setShowPSSModal(false);
            fetchProfile();
          }}
          onRemindLater={() => { setReminder("PSS"); setShowPSSModal(false); fetchProfile(); }}
        />
      )}

      {showWHOModal && (
        <WHOSurveyModal
          isOpen={showWHOModal}
          isFirstTime={whoNeverTaken}
          onClose={() => setShowWHOModal(false)}
          onComplete={(newScore) => {
            setWhoScore(newScore);
            setShowWHOModal(false);
            fetchProfile();
          }}
          onRemindLater={() => { setReminder("WHO"); setShowWHOModal(false); fetchProfile(); }}
        />
      )}
    </div>
  );
};

export default Dashboard;
