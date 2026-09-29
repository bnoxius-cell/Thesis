import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { X, UserPlus, UserCheck, Clock, ShieldPlus, ShieldMinus, UserX, ExternalLink } from "lucide-react";
import UserAvatar from "../UserAvatar";
import { useAuth } from "../../pages/authentication/AuthContext";

// A group member's card: who they are, how you're connected (with add friend), and, for
// admins, the role and removal controls. The server enforces every one of these rules again.
export default function MemberDialog({ group, member, onClose, onGroupUpdated }) {
  const { backendUrl, user } = useAuth();
  const myId = user?._id;
  const isSelf = member._id === myId;

  const memberIsOwner = group.admin?._id === member._id;
  const memberIsAdmin = memberIsOwner || (group.admins || []).includes(member._id);
  const iAmOwner = group.admin?._id === myId;
  const iAmAdmin = iAmOwner || (group.admins || []).includes(myId);

  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/user/profile/${member._id}`, { withCredentials: true });
      if (data.success) setProfile(data.profile);
    } catch {
      // The card still works without the extra details.
    }
  }, [backendUrl, member._id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (request, doneMessage, { refreshGroup = false, closeAfter = false } = {}) => {
    setBusy(true);
    try {
      const { data } = await request();
      if (data.success) {
        toast.success(doneMessage);
        if (data.group) onGroupUpdated(data.group);
        if (closeAfter) onClose();
        else if (!refreshGroup) await loadProfile();
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

  const addFriend = () => run(
    () => axios.post(`${backendUrl}/api/friends/request`, { userId: member._id }, { withCredentials: true }),
    "Friend request sent."
  );
  const acceptFriend = () => run(
    () => axios.put(`${backendUrl}/api/friends/accept/${profile.requestId}`, {}, { withCredentials: true }),
    "You're now friends."
  );
  const promote = () => run(
    () => axios.post(`${backendUrl}/api/groups/${group._id}/admins`, { userId: member._id }, { withCredentials: true }),
    `${member.name} is now an admin.`,
    { refreshGroup: true }
  );
  const demote = () => run(
    () => axios.delete(`${backendUrl}/api/groups/${group._id}/admins/${member._id}`, { withCredentials: true }),
    `${member.name} is a regular member again.`,
    { refreshGroup: true }
  );
  const remove = () => run(
    () => axios.delete(`${backendUrl}/api/groups/${group._id}/members/${member._id}`, { withCredentials: true }),
    `${member.name} was removed from the group.`,
    { closeAfter: true }
  );

  // Owners can remove anyone but themselves. Admins can only remove regular members.
  const canRemove = !isSelf && !memberIsOwner && (iAmOwner || (iAmAdmin && !memberIsAdmin));
  const roleLabel = memberIsOwner ? "Owner" : memberIsAdmin ? "Admin" : "Member";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content member-dialog" role="dialog" aria-modal="true" aria-labelledby="member-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="member-title" className="visually-hidden">{member.name}</h2>
          <span />
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="member-dialog-head">
          <UserAvatar name={member.name} src={member.avatar} size={72} />
          <div>
            <h3>{member.name}{isSelf && " (you)"}</h3>
            <span className={`role-pill role-${roleLabel.toLowerCase()}`}>{roleLabel}</span>
          </div>
        </div>

        {profile?.program && <p className="member-dialog-line">{profile.program}</p>}
        {profile?.bio && <p className="member-dialog-bio">{profile.bio}</p>}

        <div className="member-dialog-actions">
          {!isSelf && profile?.relation === "none" && (
            <button type="button" className="primary-button small" onClick={addFriend} disabled={busy}>
              <UserPlus size={15} aria-hidden="true" /> Add friend
            </button>
          )}
          {!isSelf && profile?.relation === "sent" && (
            <span className="relation-pill"><Clock size={15} aria-hidden="true" /> Request sent</span>
          )}
          {!isSelf && profile?.relation === "received" && (
            <button type="button" className="primary-button small" onClick={acceptFriend} disabled={busy}>
              <UserCheck size={15} aria-hidden="true" /> Accept request
            </button>
          )}
          {!isSelf && profile?.relation === "friends" && (
            <span className="relation-pill is-friends"><UserCheck size={15} aria-hidden="true" /> Friends</span>
          )}
          <Link to={`/profile/${member._id}`} className="secondary-button small">
            <ExternalLink size={15} aria-hidden="true" /> {isSelf ? "Your profile" : "View profile"}
          </Link>
        </div>

        {iAmAdmin && !isSelf && (canRemove || (iAmOwner && !memberIsOwner)) && (
          <div className="member-dialog-admin">
            <span className="chat-side-label">Admin controls</span>
            {iAmOwner && !memberIsOwner && (
              memberIsAdmin ? (
                <button type="button" className="ghost-button small" onClick={demote} disabled={busy}>
                  <ShieldMinus size={15} aria-hidden="true" /> Remove admin role
                </button>
              ) : (
                <button type="button" className="ghost-button small" onClick={promote} disabled={busy}>
                  <ShieldPlus size={15} aria-hidden="true" /> Make admin
                </button>
              )
            )}
            {canRemove && (confirmRemove ? (
              <div className="member-dialog-confirm">
                <span>Remove {member.name} from the group?</span>
                <button type="button" className="chat-danger-btn" onClick={remove} disabled={busy}>Yes, remove</button>
                <button type="button" className="ghost-button small" onClick={() => setConfirmRemove(false)} disabled={busy}>Keep</button>
              </div>
            ) : (
              <button type="button" className="chat-danger-btn" onClick={() => setConfirmRemove(true)} disabled={busy}>
                <UserX size={15} aria-hidden="true" /> Remove from group
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
