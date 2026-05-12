import { useAuth } from "./authentication/AuthContext";
import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../App.css";

const STORAGE_KEY = "stresscare-dashboard";
const initialProfile = {
  studentName: "",
  program: "BS Information Technology",
  studyHoursPerDay: 4,
  sleepHours: 7,
  wellbeingGoal: "steady",
};

// Helper to get optimized Google avatar URL (larger size)
const getOptimizedAvatarUrl = (avatar) => {
  if (!avatar) return null;
  // Replace default size 's96-c' with higher resolution 's150-c'
  return avatar.replace('s96-c', 's150-c');
};

// Fallback: initials avatar using ui-avatars.com
const getInitialsAvatar = (name) => {
  if (!name) return "https://ui-avatars.com/api/?name=U&background=dc2626&color=fff&size=150&rounded=true&bold=true";
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  return `https://ui-avatars.com/api/?name=${initials}&background=dc2626&color=fff&size=150&rounded=true&bold=true`;
};

export default function Profile() {
  const { user } = useAuth();
  const { uid } = useParams();
  const [profile, setProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.profile) {
          setProfile(parsed.profile);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile }));
  }, [profile]);

  const updateProfile = (key, value) => {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  };

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

  if ((!uid || uid === 'undefined') && user?._id) {
    return <Navigate to={`/profile/${user._id}`} replace />;
  }

  // Determine avatar source
  let avatarSrc = getInitialsAvatar(user.name); // fallback
  if (user.avatar && !imgError) {
    const optimized = getOptimizedAvatarUrl(user.avatar);
    if (optimized) avatarSrc = optimized;
  }

  const handleImageError = () => {
    setImgError(true);
  };

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
                  referrerPolicy="no-referrer"   // Critical for Google images
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
        </section>
      </main>
      <Footer />
    </div>
  );
}