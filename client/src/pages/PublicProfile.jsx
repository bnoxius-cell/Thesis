import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { ArrowLeft, UserPlus, UserCheck, UserMinus, Clock, Users } from "lucide-react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ConfirmDialog from "../components/ConfirmDialog";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "./authentication/AuthContext";
import "../App.css";

// Another student's profile: who they are and how you're connected. Reached from the
// friends list and from group members. Email and check-in results are never shown here.
export default function PublicProfile({ uid }) {
  const { backendUrl } = useAuth();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/user/profile/${uid}`, { withCredentials: true });
      if (data.success) {
        setProfile(data.profile);
        setStatus("ready");
      } else {
        setErrorMessage(data.message || "Couldn't load this profile.");
        setStatus("error");
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || "Couldn't load this profile.");
      setStatus("error");
    }
  }, [backendUrl, uid]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (request, doneMessage) => {
    setBusy(true);
    try {
      const { data } = await request();
      if (data.success) {
        toast.success(doneMessage);
        await load();
      } else {
        toast.error(data.message || "Something went wrong.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong.");
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  };

  const sendRequest = () => act(
    () => axios.post(`${backendUrl}/api/friends/request`, { userId: uid }, { withCredentials: true }),
    "Friend request sent."
  );
  const acceptRequest = () => act(
    () => axios.put(`${backendUrl}/api/friends/accept/${profile.requestId}`, {}, { withCredentials: true }),
    "You're now friends."
  );
  const removeFriend = () => act(
    () => axios.delete(`${backendUrl}/api/friends/${uid}`, { withCredentials: true }),
    "Friend removed."
  );

  const shell = (children) => (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">{children}</main>
      <Footer />
    </div>
  );

  if (status === "loading") {
    return shell(<div className="panel" style={{ textAlign: "center" }}><p>Loading profile...</p></div>);
  }
  if (status === "error") {
    return shell(
      <div className="panel" style={{ textAlign: "center" }}>
        <p className="schedule-empty">{errorMessage}</p>
        <Link to="/friends" className="secondary-button">Back to friends</Link>
      </div>
    );
  }

  const joined = profile.memberSince
    ? new Date(profile.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return shell(
    <>
      <Link to="/friends" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Friends</Link>

      <section className="panel public-profile">
        <UserAvatar name={profile.name} src={profile.avatar} size={112} />
        <div className="public-profile-body">
          <h1>{profile.name}</h1>
          <p className="public-profile-meta">
            {profile.program}
            {joined && <> · On StressCare since {joined}</>}
          </p>
          {profile.bio
            ? <p className="public-profile-bio">{profile.bio}</p>
            : <p className="public-profile-bio is-empty">No bio yet.</p>}

          <div className="public-profile-actions">
            {profile.relation === "none" && (
              <button type="button" className="primary-button" onClick={sendRequest} disabled={busy}>
                <UserPlus size={16} aria-hidden="true" /> Add friend
              </button>
            )}
            {profile.relation === "sent" && (
              <span className="relation-pill"><Clock size={15} aria-hidden="true" /> Friend request sent</span>
            )}
            {profile.relation === "received" && (
              <button type="button" className="primary-button" onClick={acceptRequest} disabled={busy}>
                <UserCheck size={16} aria-hidden="true" /> Accept friend request
              </button>
            )}
            {profile.relation === "friends" && (
              <>
                <span className="relation-pill is-friends"><UserCheck size={15} aria-hidden="true" /> Friends</span>
                <button type="button" className="ghost-button" onClick={() => setConfirmRemove(true)} disabled={busy}>
                  <UserMinus size={16} aria-hidden="true" /> Remove friend
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {profile.sharedGroups.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">In common</span>
              <h2>Groups you're both in</h2>
            </div>
          </div>
          <ul className="shared-groups">
            {profile.sharedGroups.map((group) => (
              <li key={group._id}>
                <Link to={`/groups?g=${group._id}`}><Users size={15} aria-hidden="true" /> {group.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Remove this friend?"
        confirmLabel="Remove friend"
        tone="danger"
        busy={busy}
        onConfirm={removeFriend}
        onCancel={() => setConfirmRemove(false)}
      >
        <p>You and <strong>{profile.name}</strong> will no longer be friends. You can send a new request later.</p>
      </ConfirmDialog>
    </>
  );
}
