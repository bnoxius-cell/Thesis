import { useAuth } from "./authentication/AuthContext";
import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import PSSSurveyModal from "../components/PSSSurveyModal";
import WHOSurveyModal from "../components/WHOSurveyModal";
import PictureField from "../components/PictureField";
import PublicProfile from "./PublicProfile";
import { surveyStatus, PSS_VALID_DAYS, WHO_VALID_DAYS } from "../utils/workload";
import "../App.css";

// Helper to get optimized Google avatar URL
const getOptimizedAvatarUrl = (avatar) => {
  if (!avatar) return null;
  return avatar.replace('s96-c', 's150-c');
};

// Your own profile at /profile/:yourId, someone else's (a friend or groupmate) at any other id.
export default function Profile() {
  const { user } = useAuth();
  const { uid } = useParams();
  if (uid && user?._id && uid !== "undefined" && uid !== user._id) return <PublicProfile uid={uid} />;
  return <OwnProfile />;
}

function OwnProfile() {
  const { user, backendUrl, getUserData } = useAuth();
  const { uid } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPicture, setSavingPicture] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Survey modals state
  const [showPSSModal, setShowPSSModal] = useState(false);
  const [showWHOModal, setShowWHOModal] = useState(false);
  const [pssScore, setPssScore] = useState(null);
  const [whoScore, setWhoScore] = useState(null);
  const [lastPSSSubmission, setLastPSSSubmission] = useState(null);
  const [lastWHOSubmission, setLastWHOSubmission] = useState(null);

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
          setPssScore(userData.latestPSSScore ?? null);
          setWhoScore(userData.latestWHOScore ?? null);
          setLastPSSSubmission(userData.lastPSSSubmission ?? null);
          setLastWHOSubmission(userData.lastWHOSubmission ?? null);
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

  const handlePSSComplete = (newScore) => {
    setPssScore(newScore);
    setLastPSSSubmission(new Date().toISOString());
    setShowPSSModal(false);
    // Optionally refetch profile to update lastPSSSubmission
  };

  const handleWHOComplete = (newScore) => {
    setWhoScore(newScore);
    setLastWHOSubmission(new Date().toISOString());
    setShowWHOModal(false);
  };

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

  // Helper to get stress level from PSS score
  const pss = surveyStatus(pssScore, lastPSSSubmission, PSS_VALID_DAYS);
  const who = surveyStatus(whoScore, lastWHOSubmission, WHO_VALID_DAYS);
  const staleNote = (status) => (status.status === "stale"
    ? `Taken ${status.ageDays} days ago. It's out of date, so it isn't counted in your workload until you retake it.`
    : null);

  const getStressLevel = (score) => {
    if (score <= 13) return "Low Stress";
    if (score <= 26) return "Moderate Stress";
    return "High Stress";
  };

  // Helper to get well-being interpretation from WHO score
  const getWellbeingInterpretation = (score) => {
    if (score <= 28) return "Very Poor Well-being";
    if (score <= 50) return "Low Well-being";
    if (score <= 75) return "Moderate Well-being";
    return "Good Well-being";
  };

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

        {/* Survey History Section */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Health Check-ins</span>
              <h2>Your latest survey results</h2>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* PSS-10 Card */}
            <div className="survey-card">
              <div className="survey-card-head">
                <div>
                  <h3>📊 Perceived Stress Scale (PSS-10)</h3>
                  <p>Your stress level over the last month</p>
                </div>
                <div className={`survey-score${pss.status === "stale" ? " is-stale" : ""}`}>
                  <div className="survey-score-value">
                    {pss.status === "stale" ? "Expired" : pssScore === null ? "No result" : `${pssScore} / 40`}
                  </div>
                  <div className="survey-score-label">
                    {pss.status === "stale" ? "Retake to refresh" : pssScore === null ? "Take the survey to personalize your score" : getStressLevel(pssScore)}
                  </div>
                </div>
              </div>
              {staleNote(pss) && <p className="survey-stale-note">{staleNote(pss)}</p>}
              <div className="survey-card-actions">
                <button
                  className="secondary-button small"
                  onClick={() => setShowPSSModal(true)}
                >
                  {!lastPSSSubmission ? "Take Survey" : "Retake Survey"}
                </button>
              </div>
            </div>

            {/* WHO-5 Card */}
            <div className="survey-card">
              <div className="survey-card-head">
                <div>
                  <h3>💚 WHO-5 Well-Being Index</h3>
                  <p>Your emotional well-being over the last two weeks</p>
                </div>
                <div className={`survey-score${who.status === "stale" ? " is-stale" : ""}`}>
                  <div className="survey-score-value">
                    {who.status === "stale" ? "Expired" : whoScore === null ? "No result" : `${whoScore} / 100`}
                  </div>
                  <div className="survey-score-label">
                    {who.status === "stale" ? "Retake to refresh" : whoScore === null ? "Take the survey to personalize your score" : getWellbeingInterpretation(whoScore)}
                  </div>
                </div>
              </div>
              {staleNote(who) && <p className="survey-stale-note">{staleNote(who)}</p>}
              <div className="survey-card-actions">
                <button
                  className="secondary-button small"
                  onClick={() => setShowWHOModal(true)}
                >
                  {!lastWHOSubmission ? "Take Survey" : "Retake Survey"}
                </button>
              </div>
            </div>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Your responses help personalize your workload recommendations. You can retake any survey at any time.
          </p>
        </section>
      </main>
      <Footer />

      {/* PSS-10 Modal */}
      <PSSSurveyModal
        isOpen={showPSSModal}
        onClose={() => setShowPSSModal(false)}
        onComplete={handlePSSComplete}
        onRemindLater={() => setShowPSSModal(false)}
      />

      {/* WHO-5 Modal */}
      <WHOSurveyModal
        isOpen={showWHOModal}
        onClose={() => setShowWHOModal(false)}
        onComplete={handleWHOComplete}
        onRemindLater={() => setShowWHOModal(false)}
      />
    </div>
  );
}
