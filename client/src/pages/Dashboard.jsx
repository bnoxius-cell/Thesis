import { useEffect, useState } from "react";
import { useAuth } from "./authentication/AuthContext";
import axios from "axios";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import WorkloadChart from "../components/WorkloadChart";
import TaskBoard from "../components/TaskBoard";
import PSSSurveyModal from "../components/PSSSurveyModal";
import WHOSurveyModal from "../components/WHOSurveyModal";
import SurveyPriorityModal from "../components/SurveyPriorityModal";
import "../App.css";

function differenceInDays(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function getTaskMetrics(task) {
  const daysLeft = differenceInDays(task.dueDate);
  const urgencyBoost =
    daysLeft < 0 ? 10 : daysLeft === 0 ? 8 : daysLeft <= 2 ? 6 : daysLeft <= 5 ? 3 : 1;
  const workload = Number(task.hours) * 1.4 + Number(task.difficulty) * 2 + Number(task.importance) * 1.8 + urgencyBoost;
  let status = "On Track";
  if (daysLeft < 0) status = "Overdue";
  else if (daysLeft <= 1) status = "Critical";
  else if (daysLeft <= 3) status = "Upcoming";
  return { daysLeft, workload, status };
}

function buildSchedule(tasks, profile) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      key: date.toISOString().split("T")[0],
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      dateLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      load: 0,
      items: [],
    };
  });

  const capacity = Math.max(Number(profile.studyHoursPerDay) || 0, 1);
  const sortedTasks = [...tasks].sort((a, b) => getTaskMetrics(b).workload - getTaskMetrics(a).workload);

  sortedTasks.forEach((task) => {
    let remainingHours = Number(task.hours);
    const { daysLeft } = getTaskMetrics(task);
    const maxSpread = Math.min(Math.max(daysLeft, 0), days.length - 1);
    for (let dayIndex = 0; dayIndex <= maxSpread && remainingHours > 0; dayIndex += 1) {
      const day = days[dayIndex];
      const available = Math.max(capacity - day.load, 0.5);
      const chunk = Math.min(remainingHours, Math.max(available, remainingHours / (maxSpread + 1 - dayIndex)));
      day.load += chunk;
      day.items.push({ title: task.title, course: task.course, hours: Number(chunk.toFixed(1)) });
      remainingHours -= chunk;
    }
    if (remainingHours > 0) {
      const lastDay = days[Math.max(0, Math.min(maxSpread, days.length - 1))];
      lastDay.load += remainingHours;
      lastDay.items.push({ title: task.title, course: task.course, hours: Number(remainingHours.toFixed(1)) });
    }
  });
  return days.map((day) => ({ ...day, load: Number(day.load.toFixed(1)), capacity }));
}

// New workload algorithm with WHO-5 and goal modifier
function computeWorkloadInsights(tasks, profile, schedule, pssScore, whoScore, isExamWeek) {
  const totalTaskHours = tasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
  const dailyCapacity = Math.max(Number(profile.studyHoursPerDay) || 0, 1);
  const availableStudyHours = dailyCapacity * 7;

  // If there are no tasks and both surveys have never been taken, workload is 0
  const hasTasks = tasks.length > 0;
  const hasSurveyData = (pssScore !== null && pssScore !== undefined) || (whoScore !== null && whoScore !== undefined);
  
  if (!hasTasks && !hasSurveyData) {
    return {
      workloadScore: 0,
      band: "Light Workload",
      suggestions: ["Add your first task to start tracking your workload."],
      T: 0,
      P: 0,
      W: 0,
      I: 0,
      D: 0,
      G: 0,
      E: 0,
      totalTaskHours: 0,
      availableStudyHours,
      importantCount: 0,
      difficultCount: 0,
    };
  }

  // Use defaults only if surveys exist but scores are missing (fallback)
  const stressScore = (pssScore !== null && pssScore !== undefined) ? pssScore : 20;
  const wellbeingScore = (whoScore !== null && whoScore !== undefined) ? whoScore : 50;

  // 1. Time Pressure Score T (0-100)
  const T = Math.min(100, (totalTaskHours / availableStudyHours) * 100);

  // 2. PSS-10 Stress Score P (0-100)
  const P = Math.min(100, (stressScore / 40) * 100);

  // 3. WHO-5 Well-being Risk Score W (0-100)
  const W = Math.min(100, Math.max(0, 100 - wellbeingScore));

  // 4. Important Task Ratio I (0-100)
  const importantTasks = tasks.filter(t => (t.importance || 3) >= 4).length;
  const I = tasks.length ? (importantTasks / tasks.length) * 100 : 0;

  // 5. Difficult Task Ratio D (0-100)
  const difficultTasks = tasks.filter(t => (t.difficulty || 3) >= 4).length;
  const D = tasks.length ? (difficultTasks / tasks.length) * 100 : 0;

  // 6. Well-being Goal Modifier G
  let G = 0;
  if (profile.wellbeingGoal === "catch-up") G = -10;
  else if (profile.wellbeingGoal === "high-performance") G = 10;

  // 7. Exam Week Modifier E
  const E = isExamWeek ? 15 : 0;

  // Final Score
  let rawScore = T * 0.30 + P * 0.20 + W * 0.20 + I * 0.15 + D * 0.10 + G + E;
  const workloadScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Workload band and interpretation
  let band = "Moderate Workload";
  if (workloadScore <= 30) band = "Light Workload";
  else if (workloadScore <= 60) band = "Moderate Workload";
  else if (workloadScore <= 80) band = "Heavy Workload";
  else band = "Critical Overload";

  // Dynamic suggestions (same as before)
  const suggestions = [];
  if (T > 70) suggestions.push("Your task hours exceed available study time. Consider reducing workload or extending deadlines.");
  else if (T > 40) suggestions.push("Your schedule is fairly full. Protect your study blocks and avoid last‑minute additions.");
  else if (hasTasks) suggestions.push("Your time load is manageable. Keep tracking to stay ahead.");
  else suggestions.push("No tasks yet – add tasks to see your workload forecast.");

  if (P > 60) suggestions.push("Your stress level is high. Take a break and consider using the wellbeing resources.");
  else if (P > 30) suggestions.push("Moderate stress detected. Short breaks and prioritising tasks can help.");

  if (W > 70) suggestions.push("Your well-being is very low. Prioritise rest and mental health. Consider talking to a counsellor.");
  else if (W > 50) suggestions.push("Your well-being is reduced. Lighten your schedule and focus on self‑care.");

  if (I > 50) suggestions.push("Half of your tasks are high priority. Focus on the most urgent ones first.");
  if (D > 50) suggestions.push("Many tasks are difficult. Break them into smaller steps and ask for help if needed.");

  if (isExamWeek) suggestions.push("Exam week is active – reduce non‑essential tasks and focus on revision.");

  if (G === -10) suggestions.push("You are in recovery mode – the system has reduced your workload target.");
  if (G === 10) suggestions.push("You are aiming for high performance – the system has increased workload tolerance.");

  if (suggestions.length === 0) suggestions.push("Keep up the good pace. Review your schedule weekly for better balance.");

  return {
    workloadScore,
    band,
    suggestions,
    T,
    P,
    W,
    I,
    D,
    G,
    E,
    totalTaskHours,
    availableStudyHours,
    importantCount: importantTasks,
    difficultCount: difficultTasks,
  };
}

const Dashboard = () => {
  const { backendUrl, isLoggedin } = useAuth();
  const [profile, setProfile] = useState({
    studentName: "",
    program: "BS Information Technology",
    studyHoursPerDay: 4,
    wellbeingGoal: "steady",
  });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importCode, setImportCode] = useState("");
  const [importingTask, setImportingTask] = useState(false);
  const [taskMessage, setTaskMessage] = useState("");

  // Survey states
  const [showPSSModal, setShowPSSModal] = useState(false);
  const [showWHOModal, setShowWHOModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
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
  const setReminder = (type) => {
    const remindUntil = Date.now() + 30 * 60 * 1000;
    localStorage.setItem(getReminderKey(type), remindUntil);
  };

  // Update modals based on due status
  const updateModalsFromDue = (pssDue, whoDue) => {
    if (!pssDue && !whoDue) {
      setShowPriorityModal(false);
      setShowPSSModal(false);
      setShowWHOModal(false);
    } else if (pssDue && whoDue) {
      setShowPriorityModal(true);
      setShowPSSModal(false);
      setShowWHOModal(false);
    } else if (pssDue) {
      setShowPriorityModal(false);
      setShowPSSModal(true);
      setShowWHOModal(false);
    } else if (whoDue) {
      setShowPriorityModal(false);
      setShowPSSModal(false);
      setShowWHOModal(true);
    }
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
        // For exam week, you would read from profile later
        // setIsExamWeek(u.isExamWeek || false);

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const pssReminder = getReminder("PSS", u._id);
        const whoReminder = getReminder("WHO", u._id);

        let pssDue = false, whoDue = false;

        if (Date.now() >= pssReminder) {
          if (!u.lastPSSSubmission) pssDue = true;
          else {
            const last = new Date(u.lastPSSSubmission);
            last.setHours(0, 0, 0, 0);
            const daysSince = (now - last) / (1000 * 60 * 60 * 24);
            if (daysSince >= 30) pssDue = true;
          }
        }

        if (Date.now() >= whoReminder) {
          if (!u.lastWHOSubmission) whoDue = true;
          else {
            const last = new Date(u.lastWHOSubmission);
            last.setHours(0, 0, 0, 0);
            const daysSince = (now - last) / (1000 * 60 * 60 * 24);
            if (daysSince >= 14) whoDue = true;
          }
        }

        updateModalsFromDue(pssDue, whoDue);
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

  useEffect(() => {
    if (isLoggedin) {
      Promise.all([fetchProfile(), fetchTasks()]).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
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

  const importTaskByCode = async (code) => {
    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      setTaskMessage("Enter a valid 6-digit task code.");
      return;
    }
    if (importingTask) return;

    setImportingTask(true);
    try {
      const { data } = await axios.post(`${backendUrl}/api/tasks/import`, { shareTag: normalizedCode }, { withCredentials: true });
      if (data.success) {
        setTasks(prev => [...prev, data.task]);
        setImportCode("");
        setTaskMessage("Task imported into your schedule.");
      } else setTaskMessage(data.message || "Task import failed.");
    } catch (err) {
      setTaskMessage(err.response?.data?.message || "Task import failed.");
    } finally {
      setImportingTask(false);
    }
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
  const schedule = buildSchedule(enrichedTasks, profile);
  const workloadInsights = computeWorkloadInsights(activeTasks, profile, schedule, pssScore, whoScore, isExamWeek);
  const completionRate = tasks.length ? Math.round(((tasks.length - activeTasks.length) / tasks.length) * 100) : 100;
  const criticalCount = enrichedTasks.filter(t => t.status === "Critical").length;

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <section className="hero" id="dashboard">
          <div className="hero-copy">
            <span className="eyebrow">Student Workload Command Center</span>
            <h1>Manage workload, reduce stress.</h1>
            <p>StressCare turns academic deadlines into a realistic weekly plan, flags overload risk, and gives you a calmer way to stay on top of submissions.</p>
            <div className="hero-metrics">
              <article className="metric-card accent">
                <span>Workload Score</span>
                <strong>{workloadInsights.workloadScore}/100</strong>
                <p>{workloadInsights.band}</p>
              </article>
              <article className="metric-card">
                <span>Active Tasks</span>
                <strong>{activeTasks.length}</strong>
                <p>{criticalCount} urgent right now</p>
              </article>
              <article className="metric-card">
                <span>Completion Rate</span>
                <strong>{completionRate}%</strong>
                <p>{workloadInsights.totalTaskHours} planned study hours</p>
              </article>
            </div>
          </div>
          <aside className="hero-panel">
            <h2>Workload Snapshot</h2>
            <div className="stress-ring"><div className="stress-ring-inner"><strong>{workloadInsights.band}</strong><span>: {workloadInsights.totalTaskHours} task hours</span></div></div>
            <ul className="hero-list">
              <li>Time pressure: {Math.round(workloadInsights.T)}%</li>
              <li>Stress score: {Math.round(workloadInsights.P)}%</li>
              <li>Well-being risk: {Math.round(workloadInsights.W)}%</li>
              <li>Important tasks: {workloadInsights.importantCount}</li>
              <li>Difficult tasks: {workloadInsights.difficultCount}</li>
              <li>Daily capacity: {profile.studyHoursPerDay} hrs</li>
              <li>Student: {profile.studentName || 'Not set'} ({profile.program})</li>
              <li>Goal: {profile.wellbeingGoal?.replace('-', ' ') || 'steady'}</li>
              {workloadInsights.G !== 0 && <li>Goal modifier: {workloadInsights.G > 0 ? `+${workloadInsights.G}` : workloadInsights.G}</li>}
              {isExamWeek && <li>⚠️ Exam week – +15 workload bonus</li>}
            </ul>
            
          </aside>
        </section>

        <section className="grid analytics-grid">
          <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Workload graph</span><h2>Weekly pressure forecast</h2></div></div><WorkloadChart schedule={schedule} /></section>
          <section className="panel insights-panel"><div className="panel-heading"><div><span className="panel-kicker">Guidance</span><h2>Recommended actions</h2></div></div><div className="insight-stack">{workloadInsights.suggestions.map((s, i) => (<article className="insight-card" key={i}><span className="insight-dot" /><p>{s}</p></article>))}</div></section>
        </section>

        <section className="panel">
          <div className="panel-heading"><div><span className="panel-kicker">Task organization</span><h2>Priority queue and smart schedule</h2></div></div>
          <form className="task-import-form" onSubmit={importTask}>
            <input type="text" inputMode="numeric" maxLength="6" value={importCode} onChange={(e) => handleImportCodeChange(e.target.value)} onPaste={handleImportCodePaste} placeholder="6-digit task tag" />
            <button type="submit" className="secondary-button" disabled={importingTask}>{importingTask ? "Importing..." : "Import Task"}</button>
          </form>
          {taskMessage && <p className="task-message">{taskMessage}</p>}
          <TaskBoard tasks={enrichedTasks} schedule={schedule} onDeleteTask={handleDeleteTask} onEditTask={updateTask} onMarkDone={markTaskDone} />
        </section>
      </main>
      <Footer />

      <SurveyPriorityModal
        isOpen={showPriorityModal}
        onSelectPSS={() => { setShowPriorityModal(false); setShowPSSModal(true); }}
        onSelectWHO={() => { setShowPriorityModal(false); setShowWHOModal(true); }}
        onRemindLater={() => { setReminder("PSS"); setReminder("WHO"); setShowPriorityModal(false); fetchProfile(); }}
      />

      <PSSSurveyModal
        isOpen={showPSSModal}
        onClose={() => setShowPSSModal(false)}
        onComplete={(newScore) => {
          setPssScore(newScore);
          setShowPSSModal(false);
          fetchProfile();
        }}
        onRemindLater={() => { setReminder("PSS"); setShowPSSModal(false); fetchProfile(); }}
      />

      <WHOSurveyModal
        isOpen={showWHOModal}
        onClose={() => setShowWHOModal(false)}
        onComplete={(newScore) => {
          setWhoScore(newScore);
          setShowWHOModal(false);
          fetchProfile();
        }}
        onRemindLater={() => { setReminder("WHO"); setShowWHOModal(false); fetchProfile(); }}
      />
    </div>
  );
};

export default Dashboard;
