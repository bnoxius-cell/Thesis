import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./authentication/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import WorkloadChart from "../components/WorkloadChart";
import TaskBoard from "../components/TaskBoard";
import PSSSurveyModal from "../components/PSSSurveyModal";
import WHOSurveyModal from "../components/WHOSurveyModal";
import CheckInBanner from "../components/CheckInBanner";
import TaskImportDialog from "../components/TaskImportDialog";
import { AlertTriangle, Eye, Lightbulb, Sparkles, CalendarDays, MapPin, CircleCheck, Download, Plus, CalendarClock } from "lucide-react";
import { toISODate, formatTime, fromISODate } from "../utils/scheduleUtils";
import { buildWeek, computeWorkload, getTaskMetrics, surveyStatus, examsToTasks, examPressure, PSS_VALID_DAYS, WHO_VALID_DAYS } from "../utils/workload";
import { suggestMoves, isStrained } from "../utils/suggestions";
import { buildFocus } from "../utils/todayFocus";
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
// Shown when nothing is on and nothing is due, worded for the time of day.
const QUIET_MESSAGE = {
  morning: "A clear morning. A good time to get ahead on something, or just to breathe.",
  afternoon: "Nothing on and nothing due. Enjoy the breathing room.",
  evening: "Nothing left for today. You can switch off.",
  night: "Nothing left for today. Time to rest.",
};

function EntryList({ entries, label, live = false }) {
  return (
    <ul className="today-list today-classes" aria-label={label}>
      {entries.map((entry, i) => (
        <li key={`${entry.title}-${entry.startTime}-${i}`} className={`today-item${live ? " is-live" : ""}`}>
          <span className={`today-dot ${entry.kind || "class"}`} aria-hidden="true" />
          <div>
            <strong>{entry.title}{live && <span className="today-now-pill">Now</span>}{entry.kind === "exam" && <span className="today-exam-pill">Exam</span>}{entry.kind === "event" && <span className="today-event-pill">Event</span>}</strong>
            <span className="today-meta">
              {formatTime(entry.startTime)} to {formatTime(entry.endTime)}
              {entry.location && <> · <MapPin size={12} aria-hidden="true" /> {entry.location}</>}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

const TIP_ICON = { alert: AlertTriangle, watch: Eye, info: Lightbulb, good: Sparkles };

const shortDate = (iso) => fromISODate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// Ideas for lightening a week that does not fit. Each one is a due date the student could move,
// worked out from the week's plan. Nothing changes until they tap the button. "Not now" hides an
// idea until tomorrow.
function SuggestionsPanel({ userId, tasks, fixedTasks, profile, overview, strained, now, onApply }) {
  const storageKey = `dismissedMoves:${userId || "anonymous"}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return Object.fromEntries(Object.entries(saved).filter(([, until]) => until > Date.now()));
    } catch {
      return {};
    }
  });

  // The inputs are rebuilt on every render, so key the memo on their values (and the minute).
  const inputsKey = JSON.stringify([
    tasks.map((t) => [t._id, t.dueDate, t.hours, t.importance, t.difficulty]), fixedTasks, profile, overview, strained, Math.floor(now / 60000),
  ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const suggestions = useMemo(() => suggestMoves({ tasks, fixedTasks, profile, overview, strained, now }), [inputsKey]);
  const visible = suggestions.filter((sug) => !dismissed[`${sug.taskId}:${sug.toDate}`]);
  if (visible.length === 0) return null;

  const dismiss = (sug) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const next = { ...dismissed, [`${sug.taskId}:${sug.toDate}`]: tomorrow.getTime() };
    setDismissed(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* private mode */ }
  };

  return (
    <section className="panel suggestions-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Smart suggestions</span>
          <h2>{strained ? "Let's make this week lighter" : "This week doesn't quite fit"}</h2>
        </div>
      </div>
      <ul className="suggestion-list">
        {visible.map((sug) => (
          <li key={`${sug.taskId}:${sug.toDate}`} className="suggestion">
            <CalendarClock size={20} aria-hidden="true" />
            <div className="suggestion-body">
              <strong>Move "{sug.title}" to {shortDate(sug.toDate)}</strong>
              <span className="suggestion-dates">
                {sug.course} · now due {shortDate(sug.fromDate)}, {sug.shift} {sug.shift === 1 ? "day" : "days"} later
              </span>
              <p>{sug.why}</p>
              <div className="suggestion-actions">
                <button type="button" className="primary-button small" onClick={() => onApply(sug)}>Move it</button>
                <button type="button" className="ghost-button small" onClick={() => dismiss(sug)}>Not now</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="suggestion-note">Only move a deadline you can really change. If a teacher set it, ask them first.</p>
    </section>
  );
}

const Dashboard = () => {
  const { backendUrl, isLoggedin } = useAuth();
  const [profile, setProfile] = useState({
    studentName: "",
    program: "BS Information Technology",
    studyHoursPerDay: 4,
    sleepHours: 8,
    hasRegularSleepSchedule: true,
    usualSleepStart: "23:00",
    usualWakeTime: "07:00",
    travelMinutesPerDay: 0,
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
  const [pssLast, setPssLast] = useState(null);
  const [whoLast, setWhoLast] = useState(null);
  // Ticks each minute so the Today panel moves on as classes start and finish.
  const [now, setNow] = useState(() => new Date());
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
          sleepHours: u.sleepHours ?? 8,
          hasRegularSleepSchedule: u.hasRegularSleepSchedule !== false,
          usualSleepStart: u.usualSleepStart || "23:00",
          usualWakeTime: u.usualWakeTime || "07:00",
          travelMinutesPerDay: u.travelMinutesPerDay ?? 0,
          wellbeingGoal: u.wellbeingGoal || "steady",
        }));
        setPssScore(u.latestPSSScore ?? null);
        setWhoScore(u.latestWHOScore ?? null);
        setPssLast(u.lastPSSSubmission || null);
        setWhoLast(u.lastWHOSubmission || null);
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
            if (daysSince >= PSS_VALID_DAYS) nextPssDue = true;
          }
        }

        if (Date.now() >= whoReminder) {
          if (!u.lastWHOSubmission) {
            nextWhoDue = !inGracePeriod;
          } else {
            const last = new Date(u.lastWHOSubmission);
            last.setHours(0, 0, 0, 0);
            const daysSince = (now - last) / (1000 * 60 * 60 * 24);
            if (daysSince >= WHO_VALID_DAYS) nextWhoDue = true;
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

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

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

  // Moves a due date the student agreed to, and offers an undo since it changes their plan.
  const applySuggestion = async (sug) => {
    await updateTask(sug.taskId, { dueDate: sug.toDate });
    toast.info(({ closeToast }) => (
      <div>
        Moved "{sug.title}" to {shortDate(sug.toDate)}.{" "}
        <button
          type="button"
          className="toast-undo"
          onClick={() => { updateTask(sug.taskId, { dueDate: sug.fromDate }); closeToast(); }}
        >
          Undo
        </button>
      </div>
    ));
  };

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
  const enrichedTasks = activeTasks.map(task => ({ ...task, ...getTaskMetrics(task, now) })).sort((a,b) => b.workload - a.workload);
  const hasSchedule = Boolean(overview?.scheduleCount && overview?.entryCount);
  // Exams in the schedule turn into study work due on the exam date, so the week, the score and
  // the guidance all plan around them. They stay out of the task list.
  const exams = overview?.upcomingExams || [];
  const examTasks = examsToTasks(exams);
  const plannedTasks = [...activeTasks, ...examTasks];
  const week = buildWeek(plannedTasks, profile, overview, now);
  // A check-in older than its window no longer describes the student, so it stays out of the score.
  const pss = surveyStatus(pssScore, pssLast, PSS_VALID_DAYS, now);
  const who = surveyStatus(whoScore, whoLast, WHO_VALID_DAYS, now);
  const workloadInsights = computeWorkload({
    tasks: plannedTasks, profile, days: week, pssScore: pss.score, whoScore: who.score, isExamWeek, hasSchedule,
    pssStatus: pss.status, whoStatus: who.status, pssAgeDays: pss.ageDays, whoAgeDays: who.ageDays, now, exams,
  });
  const nextExam = examPressure(exams, now).next;
  const strained = isStrained({ band: workloadInsights.band, pssScore: pss.score, whoScore: who.score });
  const today = week[0];
  const focus = buildFocus({ today, tomorrow: week[1], tasks: enrichedTasks, now });
  const hasFreshCheckIn = pss.score !== null || who.score !== null;
  const showTodayEntries = focus.happeningNow.length + focus.laterToday.length > 0;
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
          <p>{workloadInsights.isNewUser ? "Here's your space. Let's get it set up." : summarizeDay(today, focus)}</p>
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
              <div className="panel-heading"><div><span className="panel-kicker">{focus.kicker}</span><h2>{focus.heading}</h2></div></div>

              {today.holiday && (
                <p className="today-holiday"><CalendarDays size={16} aria-hidden="true" /> {today.holiday}. Classes that skip holidays are off today.</p>
              )}

              {nextExam && nextExam.daysLeft > 0 && (
                <p className="today-exam-note">
                  <CalendarDays size={16} aria-hidden="true" /> Next exam: <strong>{nextExam.title}</strong>{`, ${shortDate(nextExam.date)} at ${formatTime(nextExam.startTime)}`}
                </p>
              )}

              {focus.happeningNow.length > 0 && <EntryList entries={focus.happeningNow} label="Happening now" live />}

              {focus.laterToday.length > 0 && (
                <>
                  {focus.happeningNow.length > 0 && <h3 className="today-subhead">Later today</h3>}
                  <EntryList entries={focus.laterToday} label="Later today" />
                </>
              )}

              {focus.finishedCount > 0 && (
                <p className="today-finished">{focus.finishedCount} finished earlier today</p>
              )}

              {focus.dueSoon.length > 0 && (
                <>
                  {(showTodayEntries || focus.finishedCount > 0) && <h3 className="today-subhead">Due soon</h3>}
                  <ul className="today-list">
                    {focus.dueSoon.map((task) => (
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
              )}

              {focus.caughtUp ? (
                <div className="caught-up">
                  <CircleCheck size={22} aria-hidden="true" />
                  <div>
                    <strong>You're all caught up</strong>
                    <p>No open tasks right now. Enjoy it, or use the time to plan ahead.</p>
                    <div className="caught-up-actions">
                      <Link to="/create-task" className="ghost-button today-add"><Plus size={16} aria-hidden="true" /> Add a task</Link>
                      <button
                        type="button"
                        className="ghost-button today-add"
                        onClick={() => {
                          const input = document.getElementById("task-import-code");
                          input?.scrollIntoView({ behavior: "smooth", block: "center" });
                          input?.focus({ preventScroll: true });
                        }}
                      >
                        <Download size={16} aria-hidden="true" /> Import a shared task
                      </button>
                      <Link to="/schedule" className="ghost-button today-add"><CalendarDays size={16} aria-hidden="true" /> {hasSchedule ? "View schedule" : "Add your class schedule"}</Link>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {focus.dueSoon.length === 0 && focus.nextTask && (
                    <p className="today-next">
                      Nothing due right now. Next up is <strong>{focus.nextTask.title}</strong>, due in {focus.nextTask.daysLeft} days.
                    </p>
                  )}
                  {focus.dueSoon.length === 0 && !showTodayEntries && focus.finishedCount === 0 && (
                    <p className="today-empty">{today.holiday ? "A day off, and nothing due. Enjoy it." : QUIET_MESSAGE[focus.phase]}</p>
                  )}
                </>
              )}

              {focus.tomorrow && (
                <>
                  <h3 className="today-subhead">Tomorrow</h3>
                  {focus.tomorrow.holiday && (
                    <p className="today-holiday"><CalendarDays size={16} aria-hidden="true" /> {focus.tomorrow.holiday}. A day off.</p>
                  )}
                  {focus.tomorrow.entries.length > 0 ? (
                    <>
                      <EntryList entries={focus.tomorrow.entries} label="Tomorrow" />
                      {focus.tomorrow.moreEntries > 0 && <p className="today-finished">and {focus.tomorrow.moreEntries} more</p>}
                    </>
                  ) : !focus.tomorrow.holiday && (
                    <p className="today-finished">Nothing scheduled tomorrow.</p>
                  )}
                </>
              )}

              {!focus.caughtUp && (
                <div className="today-actions">
                  <Link to="/create-task" className="ghost-button today-add">+ Add a task</Link>
                  <Link to="/schedule" className="ghost-button today-add"><CalendarDays size={16} aria-hidden="true" /> {hasSchedule ? "View schedule" : "Add your class schedule"}</Link>
                </div>
              )}
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

              {!hasFreshCheckIn && (
                <p className="welcome-hint">{pss.status === "stale" || who.status === "stale" ? "Your last check-in is out of date, so it isn't counted. Retake it to make this more personal." : "This gets more personal once you take a check-in."}</p>
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

        {!workloadInsights.isNewUser && (
          <SuggestionsPanel
            userId={surveyUserId}
            tasks={activeTasks}
            fixedTasks={examTasks}
            profile={profile}
            overview={overview}
            strained={strained}
            now={now}
            onApply={applySuggestion}
          />
        )}

        <section className="panel">
          <div className="panel-heading"><div><span className="panel-kicker">All tasks</span><h2>Everything on your plate</h2></div></div>
          <form className="task-import-form" onSubmit={importTask}>
            <input id="task-import-code" type="text" inputMode="numeric" maxLength="6" value={importCode} onChange={(e) => handleImportCodeChange(e.target.value)} onPaste={handleImportCodePaste} placeholder="6-digit task tag" />
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
