import { useState, useEffect } from "react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../App.css";

const STORAGE_KEY = "stresscare-friends";

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [friendId, setFriendId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setFriends(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse friends", e);
      }
    }
  }, []);

  const saveFriends = (newFriends) => {
    setFriends(newFriends);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newFriends));
  };

  const handleAddFriend = () => {
    const trimmedId = friendId.trim();
    if (!trimmedId) {
      setError("Please enter a friend ID.");
      return;
    }
    if (friends.some(f => f.id === trimmedId)) {
      setError("Friend already added.");
      return;
    }
    const newFriend = {
      id: trimmedId,
      name: `Friend ${trimmedId.slice(0, 8)}`,
      addedAt: new Date().toISOString(),
    };
    saveFriends([...friends, newFriend]);
    setFriendId("");
    setModalOpen(false);
    setError("");
  };

  const removeFriend = (id) => {
    if (window.confirm("Remove this friend?")) {
      saveFriends(friends.filter(f => f.id !== id));
    }
  };

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <section className="hero" id="friends-hero">
          <div className="hero-copy">
            <span className="eyebrow">Study Buddies</span>
            <h1>Connect with classmates</h1>
            <p>
              Add friends by their unique ID to share tasks and collaborate on group projects.
            </p>
          </div>
          <aside className="hero-panel">
            <h2>Friends</h2>
            <ul className="hero-list">
              <li>Share tasks directly</li>
              <li>Create study groups</li>
              <li>Track team progress</li>
            </ul>
          </aside>
        </section>

        {/* Animated Add Friend Button */}
        <div style={{ display: "flex", justifyContent: "center", margin: "2rem 0" }}>
          <button
            className="friend-request-button"
            onClick={() => setModalOpen(true)}
          >
            {/* Floating particles */}
            <div className="particle left-12 top-0 text-red-300">✦</div>
            <div className="particle right-16 top-2 text-orange-300" style={{ animationDelay: "0.7s" }}>🌸</div>
            <div className="particle left-1/2 top-4 text-blue-300" style={{ animationDelay: "1.2s" }}>✨</div>

            {/* Left kitten */}
            <svg className="kitten-left" viewBox="0 0 50 50">
              <path d="M8 42C2 35 2 20 8 15" stroke="#fcd34d" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M10 45C10 30 15 15 25 15C35 15 40 30 40 45" fill="#fbbf24" />
              <path d="M15 18L8 5L22 15Z" fill="#fbbf24" />
              <path d="M15 18L11 9L19 15Z" fill="#fda4af" />
              <path d="M35 18L42 5L28 15Z" fill="#fbbf24" />
              <path d="M35 18L39 9L31 15Z" fill="#fda4af" />
              <g className="kitten-eyes">
                <circle cx="20" cy="28" r="3" fill="white" />
                <circle cx="20" cy="28" r="1.5" fill="#334155" />
                <circle cx="30" cy="28" r="3" fill="white" />
                <circle cx="30" cy="28" r="1.5" fill="#334155" />
              </g>
              <circle cx="16" cy="34" r="2" fill="#fda4af" opacity="0.6" />
              <circle cx="34" cy="34" r="2" fill="#fda4af" opacity="0.6" />
            </svg>

            {/* Right kitten */}
            <svg className="kitten-right" viewBox="0 0 50 50">
              <path d="M10 45C10 30 15 15 25 15C35 15 40 30 40 45" fill="#fef3c7" />
              <path d="M15 18L8 8L22 15Z" fill="#fef3c7" />
              <path d="M35 18L42 8L28 15Z" fill="#fef3c7" />
              <g className="kitten-blink">
                <circle cx="20" cy="28" r="1.8" fill="#92400e" />
                <circle cx="30" cy="28" r="1.8" fill="#92400e" />
              </g>
              <circle cx="15" cy="33" r="2.5" fill="#fecaca" opacity="0.5" />
              <circle cx="35" cy="33" r="2.5" fill="#fecaca" opacity="0.5" />
            </svg>

            {/* Button content */}
<div className="friend-button-content">
  <div className="friend-text-wrapper">
    <span className="friend-badge">Find a friend</span>
    <span className="friend-title">Add a Friend</span> {/* Change manually */}
  </div>
  <div className="friend-icon">
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="16" r="3.5" />
      <circle cx="8" cy="11" r="2" />
      <circle cx="12" cy="8" r="2" />
      <circle cx="16" cy="11" r="2" />
    </svg>
  </div>
</div>

            <div className="friend-button-backdrop"></div>
          </button>
        </div>

        {/* Friends List */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Your network</span>
              <h2>Friends ({friends.length})</h2>
            </div>
          </div>
          {friends.length === 0 ? (
            <p className="schedule-empty">No friends added yet. Click the button above to add your first study buddy!</p>
          ) : (
            <div className="friends-grid">
              {friends.map((friend) => (
                <div key={friend.id} className="friend-card">
                  <div className="friend-card-info">
                    <strong>{friend.name}</strong>
                    <span className="friend-id">ID: {friend.id}</span>
                    <small>Added: {new Date(friend.addedAt).toLocaleDateString()}</small>
                  </div>
                  <button
                    className="icon-btn remove-friend-btn"
                    onClick={() => removeFriend(friend.id)}
                    title="Remove friend"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add a new friend</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="form-grid">
              <div className="form-group full-span">
                <label>Friend's unique ID</label>
                <input
                  type="text"
                  value={friendId}
                  onChange={(e) => {
                    setFriendId(e.target.value);
                    setError("");
                  }}
                  placeholder="e.g., student123"
                  autoFocus
                />
                {error && <p className="form-error" style={{ marginTop: "8px" }}>{error}</p>}
              </div>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="btn-create-task" style={{ width: "auto" }} onClick={handleAddFriend}>
                  + Add Friend
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
