import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Check } from "lucide-react";
import { useAuth } from "../../pages/authentication/AuthContext";
import BusySpinner from "../BusySpinner";

const DEFAULTS = { studyHoursPerDay: 4, sleepHours: 8, usualSleepStart: "23:00", usualWakeTime: "07:00", travelMinutesPerDay: 0 };

const flagKey = (name, userId) => `stresscare:${name}:${userId}`;
const readFlag = (name, userId) => {
  try { return localStorage.getItem(flagKey(name, userId)) === "1"; } catch { return false; }
};
const writeFlag = (name, userId) => {
  try { localStorage.setItem(flagKey(name, userId), "1"); } catch { /* private mode */ }
};

// Whether the setup card has anything left to show. Used by Today to decide between the card and
// the usual next step.
export function setupState({ userData, hasSchedule, taskCount, profile }) {
  const userId = userData?._id || "";
  const weekDone = readFlag("week-set", userId)
    || Object.keys(DEFAULTS).some((key) => String(profile[key]) !== String(DEFAULTS[key]));
  const steps = {
    classes: Boolean(hasSchedule),
    week: weekDone,
    checkin: Boolean(userData?.lastPSSSubmission),
    task: taskCount > 0,
  };
  const complete = Object.values(steps).every(Boolean);
  return { steps, complete, hidden: readFlag("setup-hidden", userId) };
}

// A short list for a new student. Each row ticks itself off from real data. "Tell us about your
// week" opens a small form that saves to the profile.
export default function SetupChecklist({ work, setup, onStartCheckIn, onHide }) {
  const { backendUrl } = useAuth();
  const { profile, userId } = work;
  const { steps } = setup;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studyHoursPerDay: profile.studyHoursPerDay,
    sleepHours: profile.sleepHours,
    usualSleepStart: profile.usualSleepStart,
    usualWakeTime: profile.usualWakeTime,
    travelMinutesPerDay: profile.travelMinutesPerDay,
  });
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await axios.put(`${backendUrl}/api/user/profile`, {
        studyHoursPerDay: Number(form.studyHoursPerDay),
        sleepHours: Number(form.sleepHours),
        usualSleepStart: form.usualSleepStart,
        usualWakeTime: form.usualWakeTime,
        travelMinutesPerDay: Number(form.travelMinutesPerDay),
      }, { withCredentials: true });
      if (!data.success) {
        toast.error(data.message || "That didn't save. Try again.");
        return;
      }
      writeFlag("week-set", userId);
      await work.refreshUser();
      setOpen(false);
      toast.success("Saved. Your plan uses these numbers now.");
    } catch (err) {
      toast.error(err.response?.data?.message || "That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    { key: "classes", label: "Add your classes", action: <Link to="/schedule" className="ghost-button">Open schedule</Link> },
    {
      key: "week",
      label: "Tell us about your week",
      action: <button type="button" className="ghost-button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Fill in"}</button>,
    },
    { key: "checkin", label: "Take your first check-in", action: <button type="button" className="ghost-button" onClick={onStartCheckIn}>Start</button> },
    { key: "task", label: "Add a task", action: <Link to="/schedule?task=new" className="ghost-button">Add task</Link> },
  ];

  return (
    <section className="panel setup-card" data-tour="dash-setup">
      <h2>Let's set up your week</h2>
      <p className="setup-lead">Four small steps and StressCare can plan around you. Nothing here is urgent.</p>
      <ol className="setup-list">
        {rows.map((row) => (
          <li key={row.key} className={`setup-row${steps[row.key] ? " is-done" : ""}`}>
            <span className="setup-tick" aria-hidden="true">{steps[row.key] && <Check size={14} />}</span>
            <span className="setup-label">
              {row.label}
              {steps[row.key] && <span className="visually-hidden"> (done)</span>}
            </span>
            {!steps[row.key] && row.action}
          </li>
        ))}
      </ol>

      {open && (
        <form className="setup-form" onSubmit={save}>
          <label>Study hours a day
            <input type="number" min="1" max="12" step="0.5" value={form.studyHoursPerDay} onChange={(e) => set("studyHoursPerDay", e.target.value)} required />
          </label>
          <label>Sleep you aim for (hours)
            <input type="number" min="4" max="12" step="0.5" value={form.sleepHours} onChange={(e) => set("sleepHours", e.target.value)} required />
          </label>
          <label>Usual bedtime
            <input type="time" value={form.usualSleepStart} onChange={(e) => set("usualSleepStart", e.target.value)} required />
          </label>
          <label>Usual wake time
            <input type="time" value={form.usualWakeTime} onChange={(e) => set("usualWakeTime", e.target.value)} required />
          </label>
          <label>Travel to school and back (minutes a day)
            <input type="number" min="0" max="240" step="5" value={form.travelMinutesPerDay} onChange={(e) => set("travelMinutesPerDay", e.target.value)} required />
          </label>
          <div className="setup-form-actions">
            <button type="submit" className="primary-button" disabled={saving} aria-busy={saving}>{saving && <BusySpinner />}{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      )}

      <button type="button" className="ghost-button setup-hide" onClick={onHide}>Hide this card</button>
    </section>
  );
}
