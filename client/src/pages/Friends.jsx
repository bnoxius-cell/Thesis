import { useState, useEffect } from "react";
import { useAuth } from "./authentication/AuthContext";
import axios from "axios";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../App.css";

export default function Friends() {
  const { backendUrl } = useAuth();
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [friendTag, setFriendTag] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        axios.get(`${backendUrl}/api/friends`, { withCredentials: true }),
        axios.get(`${backendUrl}/api/friends/pending`, { withCredentials: true })
      ]);
      if (friendsRes.data.success) setFriends(friendsRes.data.friends);
      if (pendingRes.data.success) setPendingRequests(pendingRes.data.requests);
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendRequest = async () => {
    const tag = friendTag.trim().toUpperCase();
    if (!tag) {
      setError("Please enter a friend's profile tag (6 characters).");
      setTimeout(() => setError(""), 3000);
      return;
    }
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/friends/request`,
        { profileTag: tag },
        { withCredentials: true }
      );
      if (data.success) {
        setFriendTag("");
        setModalOpen(false);
        setSuccessMsg("Friend request sent!");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setError(data.message);
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send request.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      const { data } = await axios.put(`${backendUrl}/api/friends/accept/${requestId}`, {}, { withCredentials: true });
      if (data.success) {
        setSuccessMsg("Friend request accepted!");
        setTimeout(() => setSuccessMsg(""), 3000);
        fetchData(); // refresh both lists
      } else {
        setError("Failed to accept request.");
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to accept request.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const removeFriend = async (friendId) => {
    if (window.confirm("Remove this friend?")) {
      try {
        const { data } = await axios.delete(`${backendUrl}/api/friends/${friendId}`, { withCredentials: true });
        if (data.success) {
          setFriends(prev => prev.filter(f => f._id !== friendId));
          setSuccessMsg("Friend removed.");
          setTimeout(() => setSuccessMsg(""), 3000);
        } else {
          setError("Failed to remove friend.");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to remove friend.");
        setTimeout(() => setError(""), 3000);
      }
    }
  };

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        {successMsg && <div className="success-toast">{successMsg}</div>}
        {error && <div className="error-toast">{error}</div>}

        <section className="hero" id="friends-hero">
          <div className="hero-copy">
            <span className="eyebrow">Study Buddies</span>
            <h1>Connect with classmates</h1>
            <p>Add friends by their 6‑character profile tag to share tasks and collaborate on group projects.</p>
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

        {/* Animated Add Friend Button – fully original with kittens */}
        <div style={{ display: "flex", justifyContent: "center", margin: "2rem 0" }}>
          <button className="friend-request-button" onClick={() => setModalOpen(true)}>
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
                <span className="friend-title">Add a Friend</span>
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

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Friend requests</span>
                <h2>Pending ({pendingRequests.length})</h2>
              </div>
            </div>
            <div className="friends-grid">
              {pendingRequests.map((req) => (
                <div key={req._id} className="friend-card">
                  <div className="friend-card-info">
                    <strong>{req.user.name}</strong>
                    <span className="friend-id">Tag: {req.user.profileTag}</span>
                    <small>{req.user.email}</small>
                  </div>
                  <button className="primary-button small" onClick={() => acceptRequest(req._id)}>Accept</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Friends List */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Your network</span>
              <h2>Friends ({friends.length})</h2>
            </div>
          </div>
          {loading ? (
            <p className="schedule-empty">Loading friends...</p>
          ) : friends.length === 0 ? (
            <p className="schedule-empty">No friends added yet. Click the button above to add your first study buddy!</p>
          ) : (
            <div className="friends-grid">
              {friends.map((friend) => (
                <div key={friend._id} className="friend-card">
                  <div className="friend-card-info">
                    <strong>{friend.name}</strong>
                    <span className="friend-id">Tag: {friend.profileTag}</span>
                    <small>{friend.email}</small>
                  </div>
                  <button className="icon-btn remove-friend-btn" onClick={() => removeFriend(friend._id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Add Friend Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add a new friend</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="form-grid">
              <div className="form-group full-span">
                <label>Friend's 6‑character profile tag</label>
                <input
                  type="text"
                  maxLength="6"
                  value={friendTag}
                  onChange={(e) => { setFriendTag(e.target.value.toUpperCase()); setError(""); }}
                  placeholder="e.g., A3F9K2"
                  autoFocus
                />
                {error && <p className="form-error">{error}</p>}
              </div>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="btn-create-task" onClick={handleSendRequest}>Send Request</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}