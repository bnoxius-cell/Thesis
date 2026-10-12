import { useAuth } from "./authentication/AuthContext";
import { useState, useEffect } from "react";
import { useParams, Navigate, useLocation, Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import PictureField from "../components/PictureField";
import PublicProfile from "./PublicProfile";
import { useTheme } from "../context/ThemeContext";
import "../App.css";

// Helper to get optimized Google avatar URL
const getOptimizedAvatarUrl = (avatar) => {
  if (!avatar) return null;
  return avatar.replace('s96-c', 's150-c');
};

const day = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const lastCheckIn = (u) => {
  const bits = [];
  if (u?.lastPSSSubmission) bits.push(`stress on ${day(u.lastPSSSubmission)}`);
  if (u?.lastWHOSubmission) bits.push(`well-being on ${day(u.lastWHOSubmission)}`);
  return bits.length ? `You last checked in: ${bits.join(", ")}.` : "You haven't taken a check-in yet.";
};

// Your own profile at /profile/:yourId, someone else's (a friend or groupmate) at any other id.
export default function Profile() {
  const { user } = useAuth();
  const { uid } = useParams();
  if (uid && user?._id && uid !== "undefined" && uid !== user._id) return <PublicProfile uid={uid} />;
  return <OwnProfile />;
}

function OwnProfile() {
  const { user, backendUrl, getUserData, logout } = useAuth();
  const { uid } = useParams();
  const { mode, setTheme } = useTheme();
  const { hash } = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPicture, setSavingPicture] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

// Profile TAG
const shortTag = user?.profileTag || (user?._id ? user._id.slice(0, 6).toUpperCase() : "");

  // Profile state
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
    bio: "",
  });

  const [editForm, setEditForm] = useState({ ...profile });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await axios.get(`${backendUrl}/api/user/data`, { withCredentials: true });
        if (data.success && data.userData) {
          const userData = data.userData;
          const loaded = {
            studentName: userData.name || "",
            program: userData.program || "BS Information Technology",
            studyHoursPerDay: userData.studyHoursPerDay || 4,
            sleepHours: userData.sleepHours ?? 8,
            hasRegularSleepSchedule: userData.hasRegularSleepSchedule !== false,
            usualSleepStart: userData.usualSleepStart || "23:00",
            usualWakeTime: userData.usualWakeTime || "07:00",
            travelMinutesPerDay: userData.travelMinutesPerDay ?? 0,
            wellbeingGoal: userData.wellbeingGoal || "steady",
            bio: userData.bio || "",
          };
          setProfile(loaded);
          setEditForm(loaded);
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [backendUrl]);

  const handleEditChange = (key, value) => {
    setEditForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await axios.put(`${backendUrl}/api/user/profile`, editForm, { withCredentials: true });
      if (data.success) {
        setProfile({ ...editForm });
        setIsEditing(false);
      } else {
        console.error("Update failed", data.message);
      }
    } catch (err) {
      console.error("Error saving profile", err);
    } finally {
      setSaving(false);
    }
  };

  // A new photo is saved straight away, so it doesn't wait for "Save Changes" on the form.
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

  const handleCancel = () => {
    setEditForm({ ...profile });
    setIsEditing(false);
  };

  const copyProfileTag = async () => {
    if (!shortTag) return;
    try {
      await navigator.clipboard.writeText(shortTag);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Links like /profile/<id>#appearance should land on that section once the page has loaded.
  useEffect(() => {
    if (loading || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [loading, hash]);

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

  if ((!uid || uid === 'undefined') && user?._id) {
    return <Navigate to={`/profile/${user._id}`} replace />;
  }

  if (loading) {
    return (
      <div className="app app-layout">
        <Header />
        <main className="dashboard">
          <div className="panel" style={{ textAlign: "center" }}>
            <p>Loading profile...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <section className="hero" id="profile-hero">
          <div className="hero-copy">
            <span className="eyebrow">Your Account</span>
            <h1>Profile &amp; Capacity Settings</h1>
            <p>Manage your authentication and weekly study capacity.</p>
            
            {/* Profile Tag */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Your Profile Tag</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{
                  background: 'var(--input-bg)',
                  padding: '0.5rem 1rem',
                  borderRadius: '12px',
                  fontFamily: 'monospace',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  {shortTag}
                </div>
                <button
                  onClick={copyProfileTag}
                  className="secondary-button"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {copySuccess ? '✓ Copied!' : '📋 Copy Tag'}
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                Share this 6‑character tag to add friends.
              </p>
            </div>
          </div>

          <aside className="hero-panel">
            <h2>Account Info</h2>
            <div className="profile-container">
              <div className="profile-image">
                <PictureField
                  key={user.avatar || "none"}
                  value={getOptimizedAvatarUrl(user.avatar) || ""}
                  onChange={handlePictureChange}
                  name={user.name}
                  size={112}
                  disabled={savingPicture}
                  chooseLabel="Add a photo"
                />
              </div>
              <div className="profile-info">
                <h3>{user.name}</h3>
                <p>Email: {user.email}</p>
                <p>Auth Provider: {user.authProvider || 'google'}</p>
                {user.isAccountVerified && <p>Account Verified: Yes</p>}
              </div>
            </div>
          </aside>
        </section>

        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Student profile</span>
              <h2>Set your weekly capacity</h2>
            </div>
            {!isEditing ? (
              <button className="secondary-button" onClick={() => setIsEditing(true)}>
                Edit Profile
              </button>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="secondary-button" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
                <button className="primary-button" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </div>

          <div className="form-grid compact">
            <label>
              Student name
              <input
                type="text"
                placeholder="Juan Dela Cruz"
                value={isEditing ? editForm.studentName : profile.studentName}
                onChange={(e) => handleEditChange("studentName", e.target.value)}
                disabled={!isEditing}
              />
            </label>

            <label>
              Program
              <input
                type="text"
                placeholder="e.g., BS Information Technology"
                value={isEditing ? editForm.program : profile.program}
                onChange={(e) => handleEditChange("program", e.target.value)}
                disabled={!isEditing}
              />
            </label>

            <label>
              Study hours per day
              <input
                type="number"
                min="1"
                max="12"
                value={isEditing ? editForm.studyHoursPerDay : profile.studyHoursPerDay}
                onChange={(e) => handleEditChange("studyHoursPerDay", Number(e.target.value))}
                disabled={!isEditing}
              />
            </label>

            <label>
              Sleep hours per day
              <input type="number" min="6" max="12" step="0.5" value={isEditing ? editForm.sleepHours : profile.sleepHours} onChange={(e) => handleEditChange("sleepHours", Number(e.target.value))} disabled={!isEditing} />
              <small className="field-hint">Planning allows a 6 hour minimum on especially heavy weeks.</small>
            </label>

            <label>
              Travel time on school days (minutes)
              <input type="number" min="0" max="240" step="5" value={isEditing ? editForm.travelMinutesPerDay : profile.travelMinutesPerDay} onChange={(e) => handleEditChange("travelMinutesPerDay", Number(e.target.value))} disabled={!isEditing} />
              <small className="field-hint">Reserved for travel when planning study time; it is not added to your timetable.</small>
            </label>

            <label className="full-span sched-check">
              <input type="checkbox" checked={isEditing ? editForm.hasRegularSleepSchedule : profile.hasRegularSleepSchedule} onChange={(e) => handleEditChange("hasRegularSleepSchedule", e.target.checked)} disabled={!isEditing} />
              I have a regular sleep schedule
            </label>
            {(isEditing ? editForm.hasRegularSleepSchedule : profile.hasRegularSleepSchedule) && <>
              <label>Usual bedtime<input type="time" value={isEditing ? editForm.usualSleepStart : profile.usualSleepStart} onChange={(e) => handleEditChange("usualSleepStart", e.target.value)} disabled={!isEditing} /></label>
              <label>Usual wake time<input type="time" value={isEditing ? editForm.usualWakeTime : profile.usualWakeTime} onChange={(e) => handleEditChange("usualWakeTime", e.target.value)} disabled={!isEditing} /></label>
            </>}

            <label className="full-span">
              About you
              <textarea
                className="bio-input"
                rows={3}
                maxLength={200}
                placeholder="A line or two other students will see on your profile"
                value={isEditing ? editForm.bio : profile.bio}
                onChange={(e) => handleEditChange("bio", e.target.value)}
                disabled={!isEditing}
              />
              {isEditing && <small className="field-hint">{editForm.bio.length}/200</small>}
            </label>

            <label className="full-span">
              Wellbeing goal
              <select
                value={isEditing ? editForm.wellbeingGoal : profile.wellbeingGoal}
                onChange={(e) => handleEditChange("wellbeingGoal", e.target.value)}
                disabled={!isEditing}
              >
                <option value="steady">Stay balanced</option>
                <option value="catch-up">Recover from backlog</option>
                <option value="high-performance">Push for high performance</option>
              </select>
            </label>
          </div>
        </section>

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

        <section className="panel" id="sign-out">
          <button type="button" className="secondary-button" onClick={logout}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </section>
      </main>
      <Footer />
    </div>
  );
}
