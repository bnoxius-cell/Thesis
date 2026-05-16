import { useAuth } from "./authentication/AuthContext";
import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import axios from "axios";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../App.css";

// Helper to get optimized Google avatar URL (larger size)
const getOptimizedAvatarUrl = (avatar) => {
  if (!avatar) return null;
  return avatar.replace('s96-c', 's150-c');
};

// Fallback: initials avatar using ui-avatars.com
const getInitialsAvatar = (name) => {
  if (!name) return "https://ui-avatars.com/api/?name=U&background=dc2626&color=fff&size=150&rounded=true&bold=true";
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  return `https://ui-avatars.com/api/?name=${initials}&background=dc2626&color=fff&size=150&rounded=true&bold=true`;
};

export default function Profile() {
  const { user, backendUrl } = useAuth();
  const { uid } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Profile state (capacity fields only)
  const [profile, setProfile] = useState({
    studentName: "",
    program: "BS Information Technology",
    studyHoursPerDay: 4,
    wellbeingGoal: "steady",
  });

  // Temporary edit state
  const [editForm, setEditForm] = useState({ ...profile });

  // Fetch profile from backend when component mounts
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await axios.get(`${backendUrl}/api/user/data`, { withCredentials: true });
        if (data.success && data.userData) {
          const userData = data.userData;
          setProfile({
            studentName: userData.name || "",
            program: userData.program || "BS Information Technology",
            studyHoursPerDay: userData.studyHoursPerDay || 4,
            wellbeingGoal: userData.wellbeingGoal || "steady",
          });
          setEditForm({
            studentName: userData.name || "",
            program: userData.program || "BS Information Technology",
            studyHoursPerDay: userData.studyHoursPerDay || 4,
            wellbeingGoal: userData.wellbeingGoal || "steady",
          });
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
        // Optionally show success toast
      } else {
        console.error("Update failed", data.message);
      }
    } catch (err) {
      console.error("Error saving profile", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({ ...profile });
    setIsEditing(false);
  };

  // Authentication check
  if (!user) {
    return (
      <div className="app">
        <Header />
        <main className="dashboard">
          <p>Please log in to view your profile.</p>
        </main>
        <Footer />
      </div>
    );
  }

  // Redirect if no uid in URL (or "undefined")
  if ((!uid || uid === 'undefined') && user?._id) {
    return <Navigate to={`/profile/${user._id}`} replace />;
  }

  // Avatar source
  let avatarSrc = getInitialsAvatar(user.name);
  if (user.avatar && !imgError) {
    const optimized = getOptimizedAvatarUrl(user.avatar);
    if (optimized) avatarSrc = optimized;
  }

  const handleImageError = () => setImgError(true);

  if (loading) {
    return (
      <div className="app">
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
    <div className="app">
      <Header />
      <main className="dashboard">
        <section className="hero" id="profile-hero">
          <div className="hero-copy">
            <span className="eyebrow">Your Account</span>
            <h1>Profile &amp; Capacity Settings</h1>
            <p>Manage your authentication and weekly study capacity.</p>
          </div>

          <aside className="hero-panel">
            <h2>Account Info</h2>
            <div className="profile-container">
              <div className="profile-image">
                <img
                  src={avatarSrc}
                  alt="Profile"
                  onError={handleImageError}
                  referrerPolicy="no-referrer"
                  style={{ borderRadius: "50%", width: "150px", height: "150px", objectFit: "cover" }}
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
      </main>
      <Footer />
    </div>
  );
}