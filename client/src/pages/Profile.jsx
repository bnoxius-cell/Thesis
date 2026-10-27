import { useAuth } from "./authentication/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { useParams, Navigate, useLocation, Link } from "react-router-dom";
import { Check, Copy, LogOut } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import PageHeader from "../components/PageHeader";
import PictureField from "../components/PictureField";
import NotificationPreferences from "../components/NotificationPreferences";
import PublicProfile from "./PublicProfile";
import { useTheme } from "../context/ThemeContext";
import { profileFromUser } from "../utils/useWorkload";
import { HELP_CONTACTS, isPlaceholder } from "../utils/helpContacts";
import { SUPPORT_EMAILS } from "./legal/legalContent";
import "../App.css";
import BusySpinner from "../components/BusySpinner";

// Helper to get optimized Google avatar URL
const getOptimizedAvatarUrl = (avatar) => {
  if (!avatar) return null;
  return avatar.replace("s96-c", "s150-c");
};

const PROGRAMS = ["BS Information Technology", "BS Computer Science"];

const PACES = [
  { value: "catch-up", label: "Lighter", hint: "Flags a heavy week sooner. Good when you're catching up or worn out." },
  { value: "steady", label: "Balanced", hint: "The standard reading." },
  { value: "high-performance", label: "Fuller", hint: "Allows a busier week before flagging it. It stops allowing that if a check-in says you're struggling." },
];

const SECTIONS = [
  ["you", "You"],
  ["your-week", "Your week"],
  ["appearance", "Appearance"],
  ["notifications", "Notifications"],
  ["checkins", "Check-ins"],
  ["privacy", "Privacy and data"],
  ["help", "Help and more"],
];

const day = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const lastCheckIn = (u) => {
  const bits = [];
  if (u?.lastPSSSubmission) bits.push(`stress on ${day(u.lastPSSSubmission)}`);
  if (u?.lastWHOSubmission) bits.push(`well-being on ${day(u.lastWHOSubmission)}`);
  return bits.length ? `You last checked in: ${bits.join(", ")}.` : "You haven't taken a check-in yet.";
};

const sameValues = (a, b) => Object.keys(a).every((key) => String(a[key]) === String(b[key]));

// Your own profile at /profile/:yourId, someone else's (a friend or groupmate) at any other id.
export default function Profile() {
  const { user } = useAuth();
  const { uid } = useParams();
  if (uid && user?._id && uid !== "undefined" && uid !== user._id) return <PublicProfile uid={uid} />;
  return <OwnProfile />;
}

function OwnProfile() {
  const { user } = useAuth();
  const { uid } = useParams();

  if (!user) {
    return (
      <div className="app auth-layout">
        <Header />
        <main className="dashboard">
          <p>Please log in to view your profile.</p>
        </main>
        <Footer />
      </div>
    );
  }

  if ((!uid || uid === "undefined") && user._id) {
    return <Navigate to={`/profile/${user._id}`} replace />;
  }

  return <Me key={user._id} />;
}

function Me() {
  const { user, backendUrl, getUserData, logout } = useAuth();
  const { mode, setTheme } = useTheme();
  const { hash } = useLocation();
  const [savingPicture, setSavingPicture] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const onPrefsReady = useCallback(() => setPrefsReady(true), []);

  const shortTag = user.profileTag || "";

  // The saved values, and what's in the two forms right now.
  const saved = profileFromUser(user);
  const savedYou = { studentName: saved.studentName, program: saved.program, bio: user.bio || "" };
  const savedWeek = {
    studyHoursPerDay: saved.studyHoursPerDay,
    sleepHours: saved.sleepHours,
    hasRegularSleepSchedule: saved.hasRegularSleepSchedule,
    usualSleepStart: saved.usualSleepStart,
    usualWakeTime: saved.usualWakeTime,
    travelMinutesPerDay: saved.travelMinutesPerDay,
    wellbeingGoal: saved.wellbeingGoal,
  };
  const [you, setYou] = useState(savedYou);
  const [week, setWeek] = useState(savedWeek);
  const [savingYou, setSavingYou] = useState(false);
  const [savingWeek, setSavingWeek] = useState(false);

  const youDirty = !sameValues(you, savedYou);
  const weekDirty = !sameValues(week, savedWeek);
  const programs = PROGRAMS.includes(you.program) ? PROGRAMS : [you.program, ...PROGRAMS];

  // Saves part of the profile, refreshes the signed-in user (so the sidebar name updates) and
  // says what happened.
  const save = async (payload, setBusy, doneText) => {
    setBusy(true);
    try {
      const { data } = await axios.put(`${backendUrl}/api/user/profile`, payload, { withCredentials: true });
      if (data.success) {
        await getUserData();
        toast.success(doneText);
      } else {
        toast.error(data.message || "That didn't save. Try again.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveYou = (event) => {
    event.preventDefault();
    save({ studentName: you.studentName, program: you.program, bio: you.bio }, setSavingYou, "Your details are saved.");
  };

  const saveWeek = (event) => {
    event.preventDefault();
    save({
      studyHoursPerDay: Number(week.studyHoursPerDay),
      sleepHours: Number(week.sleepHours),
      hasRegularSleepSchedule: week.hasRegularSleepSchedule,
      usualSleepStart: week.usualSleepStart,
      usualWakeTime: week.usualWakeTime,
      travelMinutesPerDay: Number(week.travelMinutesPerDay),
      wellbeingGoal: week.wellbeingGoal,
    }, setSavingWeek, "Saved. Your plan uses these numbers now.");
  };

  // A new photo is saved straight away, so it doesn't wait for a Save button.
  const handlePictureChange = async (avatar) => {
    setSavingPicture(true);
    try {
      const { data } = await axios.put(`${backendUrl}/api/user/avatar`, { avatar }, { withCredentials: true });
      if (data.success) {
        await getUserData();
        toast.success(avatar ? "Profile picture updated." : "Profile picture removed.");
      } else {
        toast.error(data.message || "Couldn't save that picture.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't save that picture.");
    } finally {
      setSavingPicture(false);
    }
  };

  const copyFriendCode = async () => {
    if (!shortTag) return;
    try {
      await navigator.clipboard.writeText(shortTag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy that. Select the code and copy it by hand.");
    }
  };

  // Links like /profile/<id>#appearance should land on that section. Scroll again once the
  // notification panel has loaded, because it changes height and moves everything below it.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash, prefsReady]);

  const setYouField = (key, value) => setYou((prev) => ({ ...prev, [key]: value }));
  const setWeekField = (key, value) => setWeek((prev) => ({ ...prev, [key]: value }));
  const pace = PACES.find((p) => p.value === week.wellbeingGoal) || PACES[1];
  const mailto = `mailto:${SUPPORT_EMAILS.join(",")}`;

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard me-page">
        <PageHeader title="Profile" description="Your details, the numbers your plan uses, and how the app looks and behaves." />

        <div className="me-layout">
          <nav className="me-index" aria-label="On this page">
            <ul>
              {SECTIONS.map(([id, label]) => (
                <li key={id}><a href={`#${id}`}>{label}</a></li>
              ))}
            </ul>
          </nav>

          <div className="me-sections">
            <section className="panel" id="you">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">You</span>
                  <h2>Your details</h2>
                </div>
              </div>
              <div className="me-you">
                <PictureField
                  key={user.avatar || "none"}
                  value={getOptimizedAvatarUrl(user.avatar) || ""}
                  onChange={handlePictureChange}
                  name={user.name}
                  size={112}
                  disabled={savingPicture}
                  chooseLabel="Add a photo"
                />
                <div className="me-friend-code">
                  <span className="me-label">Friend code</span>
                  {shortTag ? (
                    <div className="me-code-row">
                      <code className="friend-code">{shortTag}</code>
                      <button type="button" className="secondary-button small" onClick={copyFriendCode}>
                        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  ) : null}
                  <small className="field-hint">
                    {shortTag ? "Share it so friends can add you." : "Your friend code isn't ready yet. Try again in a moment."} Signed in as {user.email}.
                  </small>
                </div>
              </div>

              <form className="form-grid compact me-form" onSubmit={saveYou}>
                <label>
                  Name
                  <input type="text" maxLength={60} value={you.studentName} onChange={(e) => setYouField("studentName", e.target.value)} placeholder="Juan Dela Cruz" required />
                </label>
                <label>
                  Program
                  <select value={you.program} onChange={(e) => setYouField("program", e.target.value)}>
                    {programs.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label className="full-span">
                  About you
                  <textarea
                    className="bio-input"
                    rows={3}
                    maxLength={200}
                    placeholder="A line or two other students will see on your profile"
                    value={you.bio}
                    onChange={(e) => setYouField("bio", e.target.value)}
                  />
                  <small className="field-hint">{you.bio.length}/200</small>
                </label>
                <div className="me-save full-span">
                  <button type="submit" className="primary-button" disabled={savingYou || !youDirty} aria-busy={savingYou}>{savingYou && <BusySpinner />}{savingYou ? "Saving..." : "Save"}</button>
                </div>
              </form>
            </section>

            <section className="panel" id="your-week">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">Your week</span>
                  <h2>The numbers your plan uses</h2>
                </div>
              </div>
              <form className="form-grid compact me-form" onSubmit={saveWeek}>
                <label>
                  Study hours a day
                  <input type="number" min="1" max="12" step="0.5" value={week.studyHoursPerDay} onChange={(e) => setWeekField("studyHoursPerDay", e.target.value)} required />
                </label>
                <label>
                  Sleep you aim for (hours)
                  <input type="number" min="4" max="12" step="0.5" value={week.sleepHours} onChange={(e) => setWeekField("sleepHours", e.target.value)} required />
                </label>
                <label className="full-span sched-check">
                  <input type="checkbox" checked={week.hasRegularSleepSchedule} onChange={(e) => setWeekField("hasRegularSleepSchedule", e.target.checked)} />
                  I keep a regular sleep schedule
                </label>
                {week.hasRegularSleepSchedule && (
                  <>
                    <label>Usual bedtime
                      <input type="time" value={week.usualSleepStart} onChange={(e) => setWeekField("usualSleepStart", e.target.value)} required />
                    </label>
                    <label>Usual wake time
                      <input type="time" value={week.usualWakeTime} onChange={(e) => setWeekField("usualWakeTime", e.target.value)} required />
                    </label>
                  </>
                )}
                <label className="full-span">
                  Travel on school days (minutes a day, both ways)
                  <input type="number" min="0" max="240" step="5" value={week.travelMinutesPerDay} onChange={(e) => setWeekField("travelMinutesPerDay", e.target.value)} required />
                  <small className="field-hint">Kept free when planning study time. It isn't added to your timetable.</small>
                </label>

                <fieldset className="full-span me-pace">
                  <legend>How should we pace you?</legend>
                  <div className="segmented" role="radiogroup" aria-label="Pace">
                    {PACES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        role="radio"
                        aria-checked={week.wellbeingGoal === p.value}
                        className={`segmented-option ${week.wellbeingGoal === p.value ? "is-selected" : ""}`}
                        onClick={() => setWeekField("wellbeingGoal", p.value)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="me-pace-hint">{pace.hint}</p>
                </fieldset>

                <div className="me-save full-span">
                  <button type="submit" className="primary-button" disabled={savingWeek || !weekDirty} aria-busy={savingWeek}>{savingWeek && <BusySpinner />}{savingWeek ? "Saving..." : "Save"}</button>
                </div>
              </form>
            </section>

            <section className="panel" id="appearance">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">Appearance</span>
                  <h2>Light or dark</h2>
                </div>
              </div>
              <div className="segmented" role="radiogroup" aria-label="Appearance">
                {[["light", "Light"], ["dark", "Dark"], ["system", "Match my device"]].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    className={`segmented-option ${mode === value ? "is-selected" : ""}`}
                    onClick={() => setTheme(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <div id="notifications">
              <NotificationPreferences onReady={onPrefsReady} />
            </div>

            <section className="panel" id="checkins">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">Check-ins</span>
                  <h2>Your stress and well-being check-ins</h2>
                </div>
              </div>
              <p>
                {lastCheckIn(user)} Results, history and retakes are on the <Link to="/wellbeing#checkins">Wellbeing page</Link>.
              </p>
            </section>

            <section className="panel" id="privacy">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">Privacy and data</span>
                  <h2>What we keep</h2>
                </div>
              </div>
              <p>
                Your account, tasks, schedules and check-ins are stored on StressCare's server so they're there on any device.
                The Privacy Policy says what we keep and who can see it.
              </p>
              <div className="me-links">
                <Link to="/privacy-policy" className="secondary-button small">Privacy Policy</Link>
                <Link to="/terms-of-service" className="secondary-button small">Terms of Service</Link>
                <a
                  href={`${mailto}?subject=${encodeURIComponent("Please delete my StressCare account")}`}
                  className="ghost-button small"
                >
                  Ask us to delete your account
                </a>
              </div>
            </section>

            <section className="panel" id="help">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">Help</span>
                  <h2>Help and more</h2>
                </div>
              </div>
              <ul className="me-help-list">
                <li>Today, Schedule, Study and Wellbeing have a Guide button at the bottom right. It walks you through the page.</li>
                <li><Link to="/about">About StressCare</Link></li>
                <li>Questions or problems? Email <a href={mailto}>{SUPPORT_EMAILS.join(" or ")}</a>.</li>
              </ul>
              <div className="me-talk">
                <h3>Talk to someone</h3>
                <p>If things feel like too much, you don't have to handle it alone. You can reach:</p>
                <ul>
                  {HELP_CONTACTS.map((c) => (
                    <li key={c.name}>
                      <strong>{c.name}</strong>
                      <span className={isPlaceholder(c.detail) ? "me-placeholder" : ""}>{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="panel" id="sign-out">
              <button type="button" className="secondary-button" onClick={logout}>
                <LogOut size={16} aria-hidden="true" /> Sign out
              </button>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
