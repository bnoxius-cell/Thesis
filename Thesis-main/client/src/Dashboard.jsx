import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import Header from "./Header";
import Footer from "./Footer";
import WorkloadChart from "./components/WorkloadChart";
import TaskBoard from "./components/TaskBoard";
import "./App.css";

const STORAGE_KEY = "stresscare-dashboard";

const initialProfile = {
  studentName: "",
  program: "BS Information Technology",
  studyHoursPerDay: 4,
  sleepHours: 7,
  wellbeingGoal: "steady",
};

const initialTaskForm = {
  title: "",
  course: "",
  dueDate: "",
  hours: 3,
  difficulty: 3,
  importance: 3,
};

const seededTasks = [
  {
    id: 1,
    title: "Capstone progress report",
    course: "Research Methods",
    dueDate: offsetDate(2),
    hours: 6,
    difficulty: 4,
    importance: 5,
  },
  {
    id: 2,
    title: "Database normalization worksheet",
    course: "Database Systems",
    dueDate: offsetDate(4),
    hours: 3,
    difficulty: 3,
    importance: 4,
  },
  {
    id: 3,
    title: "UI prototype revision",
    course: "Human Computer Interaction",
    dueDate: offsetDate(6),
    hours: 5,
    difficulty: 2,
    importance: 4,
  },
];

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

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

  return {
    daysLeft,
    workload,
    status,
  };
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
  const [profile, setProfile] = useState(initialProfile);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [tasks, setTasks] = useState(seededTasks);
  const { user, login, register, continueAsGuest } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (parsed.profile) setProfile(parsed.profile);
      if (Array.isArray(parsed.tasks)) setTasks(parsed.tasks);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, tasks }));
  }, [profile, tasks]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const authPromise = isLogin 
      ? login(formData.email, formData.password)
      : register(formData.name, formData.email, formData.password);

    authPromise
      .then(() => {
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Unable to sign in.');
        setLoading(false);
      });
  };

  const handleSignupAccess = () => {
    setLoading(true);
    setError('');
    continueAsGuest();
    setLoading(false);
  };

  const enrichedTasks = [...tasks]
    .map((task) => ({
      ...task,
      ...getTaskMetrics(task),
    }))
    .sort((a, b) => b.workload - a.workload);

  const schedule = buildSchedule(enrichedTasks, profile);
  const insights = buildInsights(enrichedTasks, profile, schedule);

  const completionRate = tasks.length
    ? Math.max(12, Math.round(((tasks.length - insights.overdueCount) / tasks.length) * 100))
    : 100;

  const updateProfile = (key, value) => {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateTaskForm = (key, value) => {
    setTaskForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleAddTask = (event) => {
    event.preventDefault();

    if (!taskForm.title.trim() || !taskForm.course.trim() || !taskForm.dueDate) {
      return;
    }

    const newTask = {
      id: Date.now(),
      title: taskForm.title.trim(),
      course: taskForm.course.trim(),
      dueDate: taskForm.dueDate,
      hours: Number(taskForm.hours),
      difficulty: Number(taskForm.difficulty),
      importance: Number(taskForm.importance),
    };

    setTasks((current) => [...current, newTask]);
    setTaskForm(initialTaskForm);
  };

  const handleDeleteTask = (id) => {
    setTasks((current) => current.filter((task) => task.id !== id));
  };

  if (!user) {
    return (
      <div className="app">
        <Header />
        <main className="dashboard">
          <section className="hero" id="login">
            <div className="hero-copy">
              <span className="eyebrow">Welcome to StressCare</span>
              <h1>Sign in to manage your academic workload</h1>
              <p>Access your personalized dashboard to plan tasks, track progress, and maintain balance.</p>
            </div>
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 mt-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {isLogin ? 'Sign In' : 'Create Account'}
                </h2>
                <p className="text-gray-500 mt-2">
                  {isLogin ? 'Welcome back to StressCare' : 'Join StressCare today'}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="John Doe"
                      required={!isLogin}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="student@university.edu"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="primary-button"
                  style={{ width: '100%', padding: '14px 18px' }}
                >
                  {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
              </form>

              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={isLogin ? handleSignupAccess : () => setIsLogin(true)}
                  className="secondary-button"
                  style={{ width: '100%', padding: '12px 18px' }}
                >
                  {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          </section>
        </main>
    <Footer onDashboardClick={continueAsGuest} />
      </div>
    );
  }

  return (
    <div className="app">
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
                <strong>{tasks.length}</strong>
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
            </ul>
          </aside>
        </section>

        <section className="grid">
          <section className="panel form-panel" id="assessment">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Student profile</span>
                <h2>Set your weekly capacity</h2>
              </div>
            </div>

            <div className="form-grid compact">
              <label>
                Student name
                <input
                  type="text"
                  placeholder="Juan Dela Cruz"
                  value={profile.studentName}
                  onChange={(event) => updateProfile("studentName", event.target.value)}
                />
              </label>

              <label>
                Program
                <input
                  type="text"
                  value={profile.program}
                  onChange={(event) => updateProfile("program", event.target.value)}
                />
              </label>

              <label>
                Study hours per day
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={profile.studyHoursPerDay}
                  onChange={(event) => updateProfile("studyHoursPerDay", Number(event.target.value))}
                />
              </label>

              <label>
                Sleep hours
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={profile.sleepHours}
                  onChange={(event) => updateProfile("sleepHours", Number(event.target.value))}
                />
              </label>

              <label className="full-span">
                Wellbeing goal
                <select
                  value={profile.wellbeingGoal}
                  onChange={(event) => updateProfile("wellbeingGoal", event.target.value)}
                >
                  <option value="steady">Stay balanced</option>
                  <option value="catch-up">Recover from backlog</option>
                  <option value="high-performance">Push for high performance</option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel form-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Task intake</span>
                <h2>Add academic tasks</h2>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleAddTask}>
              <label className="full-span">
                Task title
                <input
                  type="text"
                  placeholder="Network security lab report"
                  value={taskForm.title}
                  onChange={(event) => updateTaskForm("title", event.target.value)}
                />
              </label>

              <label>
                Course
                <input
                  type="text"
                  placeholder="Network Security"
                  value={taskForm.course}
                  onChange={(event) => updateTaskForm("course", event.target.value)}
                />
              </label>

              <label>
                Deadline
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(event) => updateTaskForm("dueDate", event.target.value)}
                />
              </label>

              <label>
                Estimated hours
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={taskForm.hours}
                  onChange={(event) => updateTaskForm("hours", event.target.value)}
                />
              </label>

              <label>
                Difficulty
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={taskForm.difficulty}
                  onChange={(event) => updateTaskForm("difficulty", event.target.value)}
                />
                <span className="range-value">{taskForm.difficulty}/5</span>
              </label>

              <label>
                Importance
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={taskForm.importance}
                  onChange={(event) => updateTaskForm("importance", event.target.value)}
                />
                <span className="range-value">{taskForm.importance}/5</span>
              </label>

              <button className="primary-button full-span" type="submit">
                Add task to planner
              </button>
            </form>
          </section>
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

          <TaskBoard tasks={enrichedTasks} schedule={schedule} onDeleteTask={handleDeleteTask} />
        </section>
      </main>

  <Footer onDashboardClick={continueAsGuest} />
    </div>
  );
};

export default Dashboard;
