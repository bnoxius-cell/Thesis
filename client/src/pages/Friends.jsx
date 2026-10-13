import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, UserPlus, Users, X } from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import { useAuth } from "./authentication/AuthContext";
import UserAvatar from "../components/UserAvatar";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import "../App.css";

const TAG_LENGTH = 6;

// The Friends tab of People (/groups?tab=friends). It renders inside the Groups page.
export default function Friends() {
  const { backendUrl, user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [friendTag, setFriendTag] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(null); // the friend being removed
  const [removing, setRemoving] = useState(false);

  const myTag = user?.profileTag || "";

  const fetchData = useCallback(async () => {
    try {
      const get = (path) => axios.get(`${backendUrl}/api/friends${path}`, { withCredentials: true });
      const [friendsRes, pendingRes, sentRes] = await Promise.all([get(""), get("/pending"), get("/sent")]);
      if (friendsRes.data.success) setFriends(friendsRes.data.friends);
      if (pendingRes.data.success) setIncoming(pendingRes.data.requests);
      if (sentRes.data.success) setSent(sentRes.data.requests);
    } catch (err) {
      console.error("Failed to fetch friends", err);
      toast.error("Couldn't load your friends. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Runs one friend action, then refreshes the lists. Shows the server's message once if it fails.
  const act = async (request, doneText) => {
    try {
      const { data } = await request();
      if (data.success) {
        toast.success(doneText || data.message);
        await fetchData();
        return true;
      }
      toast.error(data.message || "That didn't work. Try again.");
    } catch (err) {
      toast.error(err.response?.data?.message || "That didn't work. Try again.");
    }
    return false;
  };

  const sendRequest = async (event) => {
    event.preventDefault();
    const tag = friendTag.trim().toUpperCase();
    if (tag.length !== TAG_LENGTH) {
      toast.error(`A friend code has ${TAG_LENGTH} characters.`);
      return;
    }
    setSending(true);
    const ok = await act(
      () => axios.post(`${backendUrl}/api/friends/request`, { profileTag: tag }, { withCredentials: true }),
    );
    setSending(false);
    if (ok) setFriendTag("");
  };

  const accept = (id) => act(() => axios.put(`${backendUrl}/api/friends/accept/${id}`, {}, { withCredentials: true }), "Friend request accepted.");
  const dropRequest = (id) => act(() => axios.delete(`${backendUrl}/api/friends/request/${id}`, { withCredentials: true }));

  const removeFriend = async () => {
    const friendId = confirmRemove?._id;
    if (!friendId) return;
    setRemoving(true);
    await act(() => axios.delete(`${backendUrl}/api/friends/${friendId}`, { withCredentials: true }), "Friend removed.");
    setRemoving(false);
    setConfirmRemove(null);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(myTag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy that. Select the code and copy it by hand.");
    }
  };

  const person = (p, extra) => (
    <li key={p._id} className="person-row">
      <UserAvatar name={p.name} src={p.avatar} size={44} />
      <Link to={`/profile/${p._id}`} className="person-info" aria-label={`View ${p.name}'s profile`}>
        <strong>{p.name}</strong>
        <span>Code {p.profileTag}</span>
      </Link>
      <div className="person-actions">{extra}</div>
    </li>
  );

  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Add friends</span>
            <h2>Your friend code</h2>
          </div>
        </div>
        {myTag ? (
          <>
            <div className="me-code-row">
              <code className="friend-code">{myTag}</code>
              <button type="button" className="secondary-button small" onClick={copyCode}>
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <small className="field-hint">Share it with a classmate so they can add you.</small>
          </>
        ) : (
          <small className="field-hint">Your friend code isn't ready yet. Try again in a moment.</small>
        )}

        <form className="add-friend-form" onSubmit={sendRequest}>
          <label htmlFor="friend-code-input">Add a friend by their code</label>
          <div className="add-friend-row">
            <input
              id="friend-code-input"
              type="text"
              maxLength={TAG_LENGTH}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={friendTag}
              onChange={(e) => setFriendTag(e.target.value.toUpperCase())}
              placeholder="e.g. A3F9K2"
            />
            <button type="submit" className="primary-button" disabled={sending || friendTag.trim().length === 0}>
              <UserPlus size={18} aria-hidden="true" /> {sending ? "Sending..." : "Send request"}
            </button>
          </div>
        </form>
      </section>

      {incoming.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Requests</span>
              <h2>Waiting for your answer ({incoming.length})</h2>
            </div>
          </div>
          <ul className="person-list">
            {incoming.map((req) => person(req.user, (
              <>
                <button type="button" className="primary-button small" onClick={() => accept(req._id)}>Accept</button>
                <button type="button" className="ghost-button small" onClick={() => dropRequest(req._id)}>Decline</button>
              </>
            )))}
          </ul>
        </section>
      )}

      {sent.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Sent</span>
              <h2>Waiting for them ({sent.length})</h2>
            </div>
          </div>
          <ul className="person-list">
            {sent.map((req) => person(req.friend, (
              <button type="button" className="ghost-button small" onClick={() => dropRequest(req._id)}>Cancel</button>
            )))}
          </ul>
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Your friends</span>
            <h2>Friends ({friends.length})</h2>
          </div>
        </div>
        {loading ? (
          <p className="schedule-empty">Loading friends...</p>
        ) : friends.length === 0 ? (
          <EmptyState icon={Users} title="No friends yet">
            Share your code, or type a classmate's code above, to add your first study buddy.
          </EmptyState>
        ) : (
          <ul className="person-list">
            {friends.map((friend) => person(friend, (
              <button
                type="button"
                className="icon-action is-danger"
                onClick={() => setConfirmRemove(friend)}
                aria-label={`Remove ${friend.name}`}
                title="Remove friend"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )))}
          </ul>
        )}
      </section>

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
