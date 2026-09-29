import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Plus, Link2, MessageSquare, ShieldCheck } from "lucide-react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import GroupChat from "../components/GroupChat";
import ConfirmDialog from "../components/ConfirmDialog";
import UserAvatar from "../components/UserAvatar";
import PictureField from "../components/PictureField";
import { useAuth } from "./authentication/AuthContext";
import "../App.css";

const GROUP_REFRESH_MS = 10000;

export default function Groups() {
  const { backendUrl, user } = useAuth();
  const myId = user?._id;
  const [searchParams, setSearchParams] = useSearchParams();
  const openGroupId = searchParams.get("g");

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupIcon, setNewGroupIcon] = useState("");
  const [newGroupFamily, setNewGroupFamily] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [confirm, setConfirm] = useState(null); // { kind: "leave" | "delete", group }
  const [confirming, setConfirming] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/groups`, { withCredentials: true });
      if (data.success) {
        setGroups(data.groups);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Keep the member list fresh while a chat is open, so people who join or leave show up.
  useEffect(() => {
    if (!openGroupId) return undefined;
    const id = setInterval(() => { if (!document.hidden) fetchGroups(); }, GROUP_REFRESH_MS);
    return () => clearInterval(id);
  }, [openGroupId, fetchGroups]);

  const openChat = (groupId) => setSearchParams({ g: groupId });
  const closeChat = () => setSearchParams({});

  const closeModals = () => {
    setCreateModalOpen(false);
    setJoinModalOpen(false);
    setError("");
  };

  const handleCreateGroup = async (e) => {
    e?.preventDefault();
    const name = newGroupName.trim();
    if (!name) {
      setError("Group name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/groups`,
        { name, description: newGroupDesc.trim(), icon: newGroupIcon, familyFriendly: newGroupFamily },
        { withCredentials: true }
      );
      if (data.success) {
        setNewGroupName("");
        setNewGroupDesc("");
        setNewGroupIcon("");
        setNewGroupFamily(false);
        closeModals();
        await fetchGroups();
        toast.success("Group created. Share the join code with your classmates.");
        openChat(data.group._id);
      } else {
        setError(data.message || "Couldn't create the group.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create the group.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e?.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError("Please enter a join code.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/groups/join`,
        { joinCode: code },
        { withCredentials: true }
      );
      if (data.success) {
        setJoinCode("");
        closeModals();
        await fetchGroups();
        toast.success("You joined the group.");
        openChat(data.group._id);
      } else {
        setError(data.message === "Group not found" ? "No group found with that code." : data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't join the group.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const { kind, group } = confirm;
    setConfirming(true);
    try {
      const { data } = kind === "delete"
        ? await axios.delete(`${backendUrl}/api/groups/${group._id}`, { withCredentials: true })
        : await axios.post(`${backendUrl}/api/groups/leave`, { groupId: group._id }, { withCredentials: true });
      if (data.success) {
        toast.success(kind === "delete" ? "Group deleted." : "You left the group.");
        setConfirm(null);
        if (openGroupId === group._id) closeChat();
        await fetchGroups();
      } else {
        toast.error(data.message || "Something went wrong.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong.");
    } finally {
      setConfirming(false);
    }
  };

  const isOwner = (group) => group.admin?._id === myId;
  const isAdmin = (group) => isOwner(group) || (group.admins || []).includes(myId);
  // Roles and settings come back from the server already updated, so drop them into the list.
  const handleGroupUpdated = (updated) => setGroups((prev) => prev.map((g) => (g._id === updated._id ? updated : g)));
  const openGroup = groups.find((g) => g._id === openGroupId);

  const confirmDialog = (
    <ConfirmDialog
      open={Boolean(confirm)}
      title={confirm?.kind === "delete" ? "Delete this group?" : "Leave this group?"}
      confirmLabel={confirm?.kind === "delete" ? "Delete group" : "Leave group"}
      tone="danger"
      busy={confirming}
      onConfirm={handleConfirm}
      onCancel={() => setConfirm(null)}
    >
      {confirm?.kind === "delete" ? (
        <p>
          <strong>{confirm.group.name}</strong> and its whole chat will be deleted for everyone. This can't be undone.
        </p>
      ) : (
        <p>
          You'll leave <strong>{confirm?.group.name}</strong> and lose access to its chat. You can rejoin later with the join code.
        </p>
      )}
    </ConfirmDialog>
  );

  // Chat view: takes over the page so the conversation has room.
  if (openGroupId && !loading) {
    return (
      <div className="app app-layout">
        <Header />
        <main className="dashboard chat-page">
          {openGroup ? (
            <GroupChat
              key={openGroup._id}
              group={openGroup}
              onBack={closeChat}
              onLeave={() => setConfirm({ kind: "leave", group: openGroup })}
              onDelete={() => setConfirm({ kind: "delete", group: openGroup })}
              onGroupUpdated={handleGroupUpdated}
            />
          ) : (
            <div className="panel" style={{ textAlign: "center" }}>
              <p className="schedule-empty">
                {loadFailed
                  ? "Couldn't load your groups. Check your connection and try again."
                  : "That group doesn't exist, or you're no longer a member."}
              </p>
              <button type="button" className="secondary-button" onClick={closeChat}>Back to groups</button>
            </div>
          )}
        </main>
        {confirmDialog}
        <Footer />
      </div>
    );
  }

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <section className="hero" id="groups-hero">
          <div className="hero-copy">
            <span className="eyebrow">Collaboration Hub</span>
            <h1>Study groups & shared tasks</h1>
            <p>
              Create a group, invite classmates with a join code, then chat and share tasks to work together.
            </p>
          </div>
          <aside className="hero-panel">
            <h2>Groups</h2>
            <ul className="hero-list">
              <li>Create a group and get a join code</li>
              <li>Join a classmate's group with their code</li>
              <li>Chat with everyone in the group</li>
              <li>Share a task and let others add it to their schedule</li>
            </ul>
          </aside>
        </section>

        <div className="groups-actions">
          <button className="primary-button" onClick={() => { setError(""); setCreateModalOpen(true); }}>
            <Plus size={18} aria-hidden="true" /> Create group
          </button>
          <button className="secondary-button" onClick={() => { setError(""); setJoinModalOpen(true); }}>
            <Link2 size={18} aria-hidden="true" /> Join group
          </button>
        </div>

        {loading ? (
          <div className="panel" style={{ textAlign: "center" }}>
            <p className="schedule-empty">Loading your groups...</p>
          </div>
        ) : loadFailed ? (
          <div className="panel" style={{ textAlign: "center" }}>
            <p className="schedule-empty">Couldn't load your groups.</p>
            <button type="button" className="secondary-button" onClick={() => { setLoading(true); fetchGroups(); }}>
              Try again
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="panel" style={{ textAlign: "center" }}>
            <p className="schedule-empty">
              You're not in any group yet. Create one, or join a classmate's with a code.
            </p>
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map((group) => (
              <div key={group._id} className="group-card">
                <div className="group-header">
                  <UserAvatar name={group.name} src={group.icon} size={44} square />
                  <h3>{group.name}</h3>
                  {isOwner(group) && <span className="owner-badge">Owner</span>}
                  {!isOwner(group) && isAdmin(group) && <span className="owner-badge admin-badge">Admin</span>}
                  {group.familyFriendly && <span className="family-badge"><ShieldCheck size={12} aria-hidden="true" /> Family-friendly</span>}
                </div>
                {group.description && <p className="group-desc">{group.description}</p>}
                <div className="group-code">
                  Join code: <strong>{group.joinCode}</strong>
                </div>
                <div className="group-members">
                  <span className="group-members-title">Members ({group.members.length})</span>
                  <ul className="members-list">
                    {group.members.map((member) => (
                      <li key={member._id}>
                        <Link to={`/profile/${member._id}`} className="member-chip">
                          <UserAvatar name={member.name} src={member.avatar} size={22} />
                          {member.name} {member._id === myId && "(you)"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="group-actions">
                  <button className="primary-button small" onClick={() => openChat(group._id)}>
                    <MessageSquare size={16} aria-hidden="true" /> Open chat
                  </button>
                  <button
                    className="remove-friend-btn"
                    onClick={() => setConfirm({ kind: isOwner(group) ? "delete" : "leave", group })}
                  >
                    {isOwner(group) ? "Delete group" : "Leave group"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      {createModalOpen && (
        <div className="modal-overlay" onClick={closeModals}>
          <form className="modal-content" onClick={(e) => e.stopPropagation()} onSubmit={handleCreateGroup}>
            <div className="modal-header">
              <h2>Create a new study group</h2>
              <button type="button" className="modal-close" onClick={closeModals} aria-label="Close">×</button>
            </div>
            <div className="form-grid">
              <div className="form-group full-span">
                <label htmlFor="group-name">Group name *</label>
                <input
                  id="group-name"
                  type="text"
                  value={newGroupName}
                  maxLength={60}
                  onChange={(e) => {
                    setNewGroupName(e.target.value);
                    setError("");
                  }}
                  placeholder="e.g., CS50 Study Squad"
                  autoFocus
                />
              </div>
              <div className="form-group full-span">
                <label htmlFor="group-desc">Description (optional)</label>
                <input
                  id="group-desc"
                  type="text"
                  value={newGroupDesc}
                  maxLength={140}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="What's this group for?"
                />
              </div>
              <div className="form-group full-span">
                <span className="field-label">Group icon (optional)</span>
                <PictureField value={newGroupIcon} onChange={setNewGroupIcon} name={newGroupName} square size={64} chooseLabel="Choose an image" />
              </div>
              <label className="switch-row full-span">
                <input type="checkbox" checked={newGroupFamily} onChange={(e) => setNewGroupFamily(e.target.checked)} />
                <span>
                  <strong><ShieldCheck size={15} aria-hidden="true" /> Family-friendly chat</strong>
                  <small>Blocks messages with swearing or explicit words. Admins can change this later.</small>
                </span>
              </label>
              {error && <p className="form-error full-span">{error}</p>}
              <div className="modal-actions full-span">
                <button type="button" className="secondary-button" onClick={closeModals}>
                  Cancel
                </button>
                <button type="submit" className="btn-create-task" style={{ width: "auto" }} disabled={submitting}>
                  {submitting ? "Creating..." : "Create group"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Join Group Modal */}
      {joinModalOpen && (
        <div className="modal-overlay" onClick={closeModals}>
          <form className="modal-content" onClick={(e) => e.stopPropagation()} onSubmit={handleJoinGroup}>
            <div className="modal-header">
              <h2>Join a group</h2>
              <button type="button" className="modal-close" onClick={closeModals} aria-label="Close">×</button>
            </div>
            <div className="form-grid">
              <div className="form-group full-span">
                <label htmlFor="join-code">Enter the 6-character join code</label>
                <input
                  id="join-code"
                  type="text"
                  value={joinCode}
                  maxLength={6}
                  onChange={(e) => {
                    setJoinCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="e.g., K7M2QX"
                  autoFocus
                />
              </div>
              {error && <p className="form-error full-span">{error}</p>}
              <div className="modal-actions full-span">
                <button type="button" className="secondary-button" onClick={closeModals}>
                  Cancel
                </button>
                <button type="submit" className="btn-create-task" style={{ width: "auto" }} disabled={submitting}>
                  {submitting ? "Joining..." : "Join group"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {confirmDialog}
      <Footer />
    </div>
  );
}
