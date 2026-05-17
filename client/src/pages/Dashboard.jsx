import { useEffect, useState } from "react";
import { useAuth } from "./authentication/AuthContext";
import axios from "axios";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import WorkloadChart from "../components/WorkloadChart";
import TaskBoard from "../components/TaskBoard";
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
      day.items.push({
        title: task.title,
        course: task.course,
        hours: Number(chunk.toFixed(1)),
      });
      remainingHours -= chunk;
    }

    if (remainingHours > 0) {
      const lastDay = days[Math.max(0, Math.min(maxSpread, days.length - 1))];
      lastDay.load += remainingHours;
      lastDay.items.push({
        title: task.title,
        course: task.course,
        hours: Number(remainingHours.toFixed(1)),
      });
    }
  });

  return days.map((day) => ({
    ...day,
    load: Number(day.load.toFixed(1)),
    capacity,
  }));
}

function buildInsights(tasks, profile, schedule) {
  const metrics = tasks.map(getTaskMetrics);
  const totalLoad = metrics.reduce((sum, task) => sum + task.workload, 0);
  const totalHours = tasks.reduce((sum, task) => sum + Number(task.hours), 0);
  const overdueCount = metrics.filter((task) => task.status === "Overdue").length;
  const criticalCount = metrics.filter((task) => task.status === "Critical").length;
  const peakDay = schedule.reduce((highest, current) => (current.load > highest.load ? current : highest), schedule[0] || { load: 0, label: "N/A" });
  const sleepDeficit = Math.max(7 - Number(profile.sleepHours || 0), 0);

  const stressScore = Math.min(
    100,
    Math.round(
      totalLoad +
        totalHours * 1.5 +
        overdueCount * 12 +
        criticalCount * 7 +
        peakDay.load * 3 +
        sleepDeficit * 8
    )
  );

  let stressBand = "Balanced";
  if (stressScore >= 70) stressBand = "High Pressure";
  else if (stressScore >= 40) stressBand = "Watchlist";

  const suggestions = [
    overdueCount > 0
      ? "Start by clearing overdue work before taking on lower-impact tasks."
      : "Your deadlines are still recoverable. Protect your earliest study block for high-impact work.",
    peakDay.load > (Number(profile.studyHoursPerDay) || 4)
      ? `Your heaviest day is ${peakDay.label}. Move 1-2 hours of work earlier in the week to avoid crunch time.`
      : "Your week is reasonably distributed. Keep short review blocks in place to avoid last-minute stress.",
    sleepDeficit > 0
      ? "Sleep is below the 7-hour target. Even one additional hour can lower cognitive overload."
      : "Sleep target looks healthy. Keep bedtime consistent during heavy submission weeks.",
  ];

  return {
    totalLoad: Number(totalLoad.toFixed(1)),
    totalHours,
    overdueCount,
    criticalCount,
    peakDay,
    stressScore,
    stressBand,
    suggestions,
  };
}

const Dashboard = () => {
  const { backendUrl, isLoggedin } = useAuth();
  const [profile, setProfile] = useState({
    studentName: "",
    program: "BS Information Technology",
    studyHoursPerDay: 4,
    sleepHours: 7,
    wellbeingGoal: "steady",
  });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importCode, setImportCode] = useState("");
  const [taskMessage, setTaskMessage] = useState("");

  // Fetch tasks from backend
  const fetchTasks = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/tasks`, { withCredentials: true });
      if (data.success) setTasks(data.tasks);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    }
  };

  // Load profile from localStorage (temporary – will be replaced with backend later)
  useEffect(() => {
    const saved = localStorage.getItem("stresscare-dashboard");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.profile) setProfile(parsed.profile);
      } catch (e) {}
    }
  }, []);

  // Save profile to localStorage (temporary)
  useEffect(() => {
    localStorage.setItem("stresscare-dashboard", JSON.stringify({ profile }));
  }, [profile]);

  // Fetch tasks when user is logged in
  useEffect(() => {
    if (isLoggedin) {
      fetchTasks();
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [isLoggedin]);

  const updateProfile = (key, value) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const { data } = await axios.delete(`${backendUrl}/api/tasks/${taskId}`, { withCredentials: true });
      if (data.success) {
        setTasks((prev) => prev.filter((t) => t._id !== taskId));
      } else {
        console.error("Delete failed", data.message);
      }
    } catch (err) {
      console.error("Delete error", err);
    }
  };

  const markTaskDone = async (taskId) => {
    await updateTask(taskId, { isCompleted: true });
  };

  const updateTask = async (taskId, updatedFields) => {
    try {
      const { data } = await axios.put(`${backendUrl}/api/tasks/${taskId}`, updatedFields, { withCredentials: true });
      if (data.success) {
        setTasks((prev) => prev.map((t) => (t._id === taskId ? data.task : t)));
      }
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  const importTask = async (e) => {
    e.preventDefault();
    const normalizedCode = importCode.trim();

    if (!/^\d{6}$/.test(normalizedCode)) {
      setTaskMessage("Enter a valid 6-digit task code.");
      return;
    }

    try {
      const { data } = await axios.post(
        `${backendUrl}/api/tasks/import`,
        { shareTag: normalizedCode },
        { withCredentials: true }
      );

      if (data.success) {
        setTasks((prev) => [...prev, data.task]);
        setImportCode("");
        setTaskMessage("Task imported into your schedule.");
      } else {
        setTaskMessage(data.message || "Task import failed.");
      }
    } catch (err) {
      setTaskMessage(err.response?.data?.message || "Task import failed.");
    }
  };

  if (!isLoggedin) {
    return (
      <div className="app auth-layout">
        <Header />
        <main className="dashboard">
          <p>Please log in to view your dashboard.</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app app-layout">
        <Header />
        <main className="dashboard">
          <div className="panel" style={{ textAlign: "center" }}>
            <p>Loading dashboard...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const activeTasks = tasks.filter((task) => !task.isCompleted);
  const enrichedTasks = [...activeTasks]
    .map((task) => ({
      ...task,
      ...getTaskMetrics(task),
    }))
    .sort((a, b) => b.workload - a.workload);

  const schedule = buildSchedule(enrichedTasks, profile);
  const insights = buildInsights(enrichedTasks, profile, schedule);

  const completionRate = tasks.length
    ? Math.round(((tasks.length - activeTasks.length) / tasks.length) * 100)
    : 100;

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <section className="hero" id="dashboard">
          <div className="hero-copy">
            <span className="eyebrow">Student Workload Command Center</span>
            <h1>Plan tasks early, spread the pressure, and protect your energy.</h1>
            <p>
              StressCare turns academic deadlines into a realistic weekly plan, flags overload
              risk, and gives you a calmer way to stay on top of submissions.
            </p>

            <div className="hero-metrics">
              <article className="metric-card accent">
                <span>Stress Score</span>
                <strong>{insights.stressScore}/100</strong>
                <p>{insights.stressBand}</p>
              </article>
              <article className="metric-card">
                <span>Tracked Tasks</span>
                <strong>{activeTasks.length}</strong>
                <p>{insights.criticalCount} urgent right now</p>
              </article>
              <article className="metric-card">
                <span>Completion Outlook</span>
                <strong>{completionRate}%</strong>
                <p>{insights.totalHours} planned study hours</p>
              </article>
            </div>
          </div>

          <aside className="hero-panel">
            <h2>Stress Snapshot</h2>
            <div className="stress-ring">
              <div className="stress-ring-inner">
                <strong>{insights.stressBand}</strong>
                <span>{insights.totalLoad} workload points</span>
              </div>
            </div>

            <ul className="hero-list">
              <li>Peak day: {insights.peakDay.label}</li>
              <li>Overdue tasks: {insights.overdueCount}</li>
              <li>Daily study capacity: {profile.studyHoursPerDay} hrs</li>
              <li>Student: {profile.studentName || 'Not set'} ({profile.program})</li>
              <li>Sleep target: {profile.sleepHours} hrs</li>
              <li>Goal: {profile.wellbeingGoal.replace('-', ' ')}</li>
            </ul>
            <p className="profile-note">
              <small>Edit profile <a href="/profile">here</a></small>
            </p>
          </aside>
        </section>

        <section className="grid analytics-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Workload graph</span>
                <h2>Weekly pressure forecast</h2>
              </div>
            </div>
            <WorkloadChart schedule={schedule} />
          </section>

          <section className="panel insights-panel" id="reports">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Guidance</span>
                <h2>Recommended actions</h2>
              </div>
            </div>

            <div className="insight-stack">
              {insights.suggestions.map((suggestion) => (
                <article className="insight-card" key={suggestion}>
                  <span className="insight-dot" />
                  <p>{suggestion}</p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Task organization</span>
              <h2>Priority queue and smart schedule</h2>
            </div>
          </div>

          <form className="task-import-form" onSubmit={importTask}>
            <input
              type="text"
              inputMode="numeric"
              maxLength="6"
              value={importCode}
              onChange={(e) => setImportCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit task code"
              aria-label="6-digit task code"
            />
            <button type="submit" className="secondary-button">Import Task</button>
          </form>
          {taskMessage && <p className="task-message">{taskMessage}</p>}

          <TaskBoard
            tasks={enrichedTasks}
            schedule={schedule}
            onDeleteTask={handleDeleteTask}
            onEditTask={updateTask}
            onMarkDone={markTaskDone}
          />
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
