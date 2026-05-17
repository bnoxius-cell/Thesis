import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./authentication/AuthContext";
import axios from "axios";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../App.css";

const initialTaskForm = {
  title: "",
  course: "",
  description: "",
  dueDate: "",
  hours: 3,
  difficulty: 3,
  importance: 3,
};

export default function TaskCreation() {
  const { isLoggedin, backendUrl } = useAuth();
  const navigate = useNavigate();
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const updateTaskForm = (key, value) => {
    setTaskForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddTask = async (e) => {
    e.preventDefault();

    if (!taskForm.title.trim() || !taskForm.course.trim() || !taskForm.dueDate) {
      setMessage("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data } = await axios.post(`${backendUrl}/api/tasks`, taskForm, {
        withCredentials: true,
      });
      if (data.success) {
        setMessage("Task created successfully! Redirecting...");
        setTaskForm(initialTaskForm);
        setTimeout(() => navigate("/"), 1500);
      } else {
        setMessage(data.message || "Task creation failed.");
      }
    } catch (err) {
      console.error("Create task error:", err);
      setMessage(err.response?.data?.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedin) {
    return (
      <div className="app auth-layout">
        <Header />
        <main className="dashboard">
          <p>Please log in to create tasks.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <section className="hero">
          <h1>Create New Task</h1>
          <p>Add a new task to your study schedule.</p>
          {message && (
            <p className="message" style={{ color: message.includes("success") ? "green" : "red" }}>
              {message}
            </p>
          )}
          <form className="form-grid" onSubmit={handleAddTask}>
            <div className="form-group">
              <label htmlFor="title">Task Title *</label>
              <input
                id="title"
                type="text"
                value={taskForm.title}
                onChange={(e) => updateTaskForm("title", e.target.value)}
                placeholder="e.g., Capstone progress report"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="course">Course *</label>
              <input
                id="course"
                type="text"
                value={taskForm.course}
                onChange={(e) => updateTaskForm("course", e.target.value)}
                placeholder="e.g., Research Methods"
                required
              />
            </div>

            <div className="form-group full-span">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={taskForm.description}
                onChange={(e) => updateTaskForm("description", e.target.value)}
                placeholder="Optional notes, instructions, or task details"
                rows="4"
              />
            </div>

            <div className="form-group">
              <label htmlFor="dueDate">Due Date *</label>
              <input
                id="dueDate"
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => updateTaskForm("dueDate", e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="hours">Estimated Hours</label>
              <input
                id="hours"
                type="number"
                min="0.5"
                max="20"
                step="0.5"
                value={taskForm.hours}
                onChange={(e) => updateTaskForm("hours", Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="difficulty">Difficulty (1-5)</label>
              <input
                id="difficulty"
                type="range"
                min="1"
                max="5"
                value={taskForm.difficulty}
                onChange={(e) => updateTaskForm("difficulty", Number(e.target.value))}
              />
              <span>{taskForm.difficulty}</span>
            </div>

            <div className="form-group">
              <label htmlFor="importance">Importance (1-5)</label>
              <input
                id="importance"
                type="range"
                min="1"
                max="5"
                value={taskForm.importance}
                onChange={(e) => updateTaskForm("importance", Number(e.target.value))}
              />
              <span>{taskForm.importance}</span>
            </div>

            <button type="submit" className="btn-create-task" disabled={loading}>
              <span className="btn-icon">+</span>
              {loading ? "Creating..." : "Create Task"}
            </button>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  );
}
