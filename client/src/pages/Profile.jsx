    import { useAuth } from "./authentication/AuthContext";
    import { useState, useEffect } from "react";
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

    export default function Profile() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(initialProfile);
    const [loading, setLoading] = useState(true);

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
                    src={user.avatar || "https://via.placeholder.com/150"}
                    alt="Profile"
                    style={{ borderRadius: "50%", width: "150px", height: "150px" }}
                    />
                </div>
                <div className="profile-info">
                    <h3>{user.name}</h3>
                    <p>Email: {user.email}</p>
                    <p>Auth Provider: {user.authProvider}</p>
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
