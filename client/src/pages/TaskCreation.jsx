import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../App.css";

const initialTaskForm = {
  title: "",
  course: "",
  dueDate: "",
  hours: 3,
  difficulty: 3,
  importance: 3,
};

export default function TaskCreation() {
  const { user } = useAuth();
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [message, setMessage] = useState("");

  const updateTaskForm = (key, value) => {
    setTaskForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleAddTask = (event) => {
    event.preventDefault();

    if (!taskForm.title.trim() || !taskForm.course.trim() || !taskForm.dueDate) {
      setMessage("Please fill in all required fields.");
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

    console.log("New task created:", newTask);
    setMessage("Task created successfully!");
    setTaskForm(initialTaskForm);
  };

  if (!user) {
    return (
      <div>
        <Header />
        <main className="dashboard">
          <p>Please log in to create tasks.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="dashboard">
        <section className="hero">
          <h1>Create New Task</h1>
          <p>Add a new task to your study schedule.</p>
          {message && <p className="message">{message}</p>}
          <form className="form-grid" onSubmit={handleAddTask}>
            <div className="form-group">
              <label htmlFor="title">Task Title *</label>
              <input
                id="title"
                type="text"
                value={taskForm.title}
                onChange={(event) => updateTaskForm("title", event.target.value)}
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
                onChange={(event) => updateTaskForm("course", event.target.value)}
                placeholder="e.g., Research Methods"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="dueDate">Due Date *</label>
              <input
                id="dueDate"
                type="date"
                value={taskForm.dueDate}
                onChange={(event) => updateTaskForm("dueDate", event.target.value)}
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
                onChange={(event) => updateTaskForm("hours", Number(event.target.value))}
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
                onChange={(event) => updateTaskForm("difficulty", Number(event.target.value))}
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
                onChange={(event) => updateTaskForm("importance", Number(event.target.value))}
              />
              <span>{taskForm.importance}</span>
            </div>

            {/* IMPROVED BUTTON STARTS HERE */}
            <button type="submit" className="btn-create-task">
              <span className="btn-icon">+</span>
              Create Task
            </button>
            {/* IMPROVED BUTTON ENDS HERE */}
          </form>
        </section>
      </main>
      <Footer />
    </div>
  );
}