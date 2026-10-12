import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useAuth } from "./authentication/AuthContext";
import axios from "axios";
import UserAvatar from "../components/UserAvatar";
import ConfirmDialog from "../components/ConfirmDialog";
import "../App.css";

// The Friends tab of People (/groups?tab=friends). It renders inside the Groups page.
export default function Friends() {
  const { backendUrl } = useAuth();
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [friendTag, setFriendTag] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(null); // the friend being removed
  const [removing, setRemoving] = useState(false);

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

  const removeFriend = async () => {
    const friendId = confirmRemove?._id;
    if (!friendId) return;
    setRemoving(true);
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
    } finally {
      setRemoving(false);
      setConfirmRemove(null);
    }
  };

  return (
    <>
        {successMsg && <div className="success-toast">{successMsg}</div>}
        {error && <div className="error-toast">{error}</div>}

        <div className="groups-actions">
          <button className="primary-button" onClick={() => setModalOpen(true)}>
            <UserPlus size={18} aria-hidden="true" /> Add a friend
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
                  <UserAvatar name={req.user.name} src={req.user.avatar} size={48} />
                  <Link to={`/profile/${req.user._id}`} className="friend-card-info">
                    <strong>{req.user.name}</strong>
                    <span className="friend-id">Tag: {req.user.profileTag}</span>
                    <small>{req.user.email}</small>
                  </Link>
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
                  <UserAvatar name={friend.name} src={friend.avatar} size={48} />
                  <Link to={`/profile/${friend._id}`} className="friend-card-info" aria-label={`View ${friend.name}'s profile`}>
                    <strong>{friend.name}</strong>
                    <span className="friend-id">Tag: {friend.profileTag}</span>
                    <small>{friend.email}</small>
                  </Link>
                  <button className="icon-btn remove-friend-btn" onClick={() => setConfirmRemove(friend)} aria-label={`Remove ${friend.name}`}>✕</button>
                </div>
              ))}
            </div>
          )}
        </section>

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

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        title="Remove this friend?"
        confirmLabel="Remove friend"
        tone="danger"
        busy={removing}
        onConfirm={removeFriend}
        onCancel={() => setConfirmRemove(null)}
      >
        <p>You and <strong>{confirmRemove?.name}</strong> will no longer be friends. You can send a new request later.</p>
      </ConfirmDialog>

    </>
  );
}