import React, { useState, useEffect } from "react";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { useAuth } from "../authentication/AuthContext";

const STORAGE_KEY = "stresscare-dashboard";

export default function Profile() {
  const { user } = useAuth();
  
  const [profileData, setProfileData] = useState({
    program: "BS Information Technology",
    studyHoursPerDay: 4,
    sleepHours: 7,
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.profile) {
          setProfileData(parsed.profile);
        }
      } catch (e) {
        console.error("Could not load local profile data", e);
      }
    }
  }, []);

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="app">
      <Header />
      <main className="dashboard">
        {/* Profile Card at the very top */}
        <section className="profile-card">
          <div className="profile-avatar">
            {user?.avatar ? (
              <img src={user.avatar} alt={user?.name || "Avatar"} />
            ) : (
              <span>{getInitials(user?.name)}</span>
            )}
          </div>
          <div className="profile-info">
            <h1 className="profile-name">{user?.name || "Student Name"}</h1>
            <p className="profile-email">{user?.email || "student@fatima.edu.ph"}</p>
            {user?.isAccountVerified && (
              <span className="profile-status">Verified Account</span>
            )}
          </div>
        </section>

        {/* Form panel for other details */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Preferences</span>
              <h2>Academic Details</h2>
            </div>
          </div>
          
          <div className="form-grid">
            <div className="form-group full-span">
              <label>Program</label>
              <input 
                type="text" 
                value={profileData.program} 
                disabled 
                style={{ opacity: 0.7, cursor: "not-allowed" }}
              />
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Program is locked to default for now.
              </p>
            </div>
            
            <div className="form-group">
              <label>Study Capacity (Hours/Day)</label>
              <input 
                type="number" 
                value={profileData.studyHoursPerDay} 
                disabled 
                style={{ opacity: 0.7, cursor: "not-allowed" }}
              />
            </div>
            
            <div className="form-group">
              <label>Sleep Target (Hours)</label>
              <input 
                type="number" 
                value={profileData.sleepHours} 
                disabled 
                style={{ opacity: 0.7, cursor: "not-allowed" }}
              />
            </div>
          </div>
          
          <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--border-light)" }}>
             <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Go to the Dashboard to update your study capacity and sleep goals.
             </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}