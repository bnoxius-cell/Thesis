import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Plus, KeyRound, MessageSquare, ShieldCheck, Users } from "lucide-react";
import AppShell, { ShellOverlays } from "../components/layout/AppShell";
import GroupChat from "../components/GroupChat";
import ConfirmDialog from "../components/ConfirmDialog";
import UserAvatar from "../components/UserAvatar";
import PictureField from "../components/PictureField";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { useNotifications } from "../context/NotificationContext";
import { GROUPS_TOUR } from "../utils/tours";
import { useAuth } from "./authentication/AuthContext";
import "../App.css";
import "../styles/pages/groups.css";
import Modal from "../components/Modal";
import BusySpinner from "../components/BusySpinner";

const GROUP_REFRESH_MS = 10000;

export default function Groups() {
  const { backendUrl, user } = useAuth();
  const myId = user?._id;
  const { groupUnreadById } = useNotifications();
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

  // Back on the list (phones), focus goes to the row that was open instead of dropping to the page.
  const lastOpenRef = useRef(null);
  useEffect(() => {
    if (openGroupId) {
      lastOpenRef.current = openGroupId;
      return;
    }
    const id = lastOpenRef.current;
    lastOpenRef.current = null;
    if (id) document.querySelector(`[data-group-id="${id}"]`)?.focus({ preventScroll: true });
  }, [openGroupId]);

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

  const actions = (
    <div className="groups-actions" data-tour="groups-actions">
      <button type="button" className="primary-button" onClick={() => { setError(""); setCreateModalOpen(true); }}>
        <Plus size={18} aria-hidden="true" /> New group
      </button>
      <button type="button" className="secondary-button" onClick={() => { setError(""); setJoinModalOpen(true); }}>
        <KeyRound size={18} aria-hidden="true" /> Join with a code
      </button>
    </div>
  );

  const listBody = () => {
    if (loading) return <p className="groups-state" role="status">Loading your groups...</p>;
    if (loadFailed) {
      return (
        <div className="groups-state">
          <p>Couldn't load your groups.</p>
          <button type="button" className="secondary-button" onClick={() => { setLoading(true); fetchGroups(); }}>
            Try again
          </button>
        </div>
      );
    }
    return (
      <ul className="groups-list stagger">
        {groups.map((group) => {
          const active = group._id === openGroupId;
          const unread = active ? 0 : groupUnreadById[group._id] || 0;
          const role = isOwner(group) ? "Owner" : isAdmin(group) ? "Admin" : "";
          return (
            <li key={group._id}>
              <button
                type="button"
                className="group-row"
                data-group-id={group._id}
                aria-current={active ? "true" : undefined}
                onClick={() => openChat(group._id)}
              >
                <UserAvatar name={group.name} src={group.icon} size={40} square />
                <span className="group-row-text">
                  <strong>{group.name}</strong>
                  <span>
                    {group.members.length} {group.members.length === 1 ? "member" : "members"}
                    {role && ` · ${role}`}
                  </span>
                </span>
                {unread > 0 && (
                  <span className="group-unread">
                    <span aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
                    <span className="sr-only">{unread} unread</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const detail = () => {
    if (!openGroupId) {
      return (
        <div className="groups-placeholder">
          <EmptyState icon={MessageSquare} title="Pick a group">
            Its chat opens here, with the tasks and schedules people have shared.
          </EmptyState>
        </div>
      );
    }
    if (loading) return <div className="groups-placeholder"><p className="groups-state" role="status">Opening the chat...</p></div>;
    if (!openGroup) {
      return (
        <div className="groups-placeholder">
          <div className="groups-state">
            <p>
              {loadFailed
                ? "Couldn't load your groups. Check your connection and try again."
                : "That group doesn't exist, or you're no longer a member."}
            </p>
            <button type="button" className="secondary-button" onClick={closeChat}>Back to groups</button>
          </div>
        </div>
      );
    }
    return (
      <GroupChat
        key={openGroup._id}
        group={openGroup}
        onBack={closeChat}
        onLeave={() => setConfirm({ kind: "leave", group: openGroup })}
        onDelete={() => setConfirm({ kind: "delete", group: openGroup })}
        onGroupUpdated={handleGroupUpdated}
      />
    );
  };

  const noGroups = !loading && !loadFailed && groups.length === 0;

  return (
    <AppShell
      mainClassName={`groups-page${openGroupId ? " has-open" : ""}`}
      tour={{ page: "groups", title: "Groups", steps: GROUPS_TOUR, view: openGroupId ? "open" : "list" }}
    >
      <PageHeader title="Groups" description="Study groups for your classes: chat, and share tasks and schedules." actions={actions} />

      {noGroups ? (
        <section className="panel" data-tour="groups-list">
          <EmptyState icon={Users} title="No groups yet">
            Create one for your class, or join a classmate's with their 6-character code.
          </EmptyState>
        </section>
      ) : (
        <div className="groups-layout">
          <section className="groups-list-pane" aria-label="Your groups" data-tour="groups-list">
            {listBody()}
          </section>
          <div className="groups-detail-pane">{detail()}</div>
        </div>
      )}

      <ShellOverlays>
      {/* Create Group Modal */}
      {createModalOpen && (
        <Modal onClose={closeModals} as="form" onSubmit={handleCreateGroup}>
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
                <button type="submit" className="primary-button" disabled={submitting} aria-busy={submitting}>{submitting && <BusySpinner />}
                  {submitting ? "Creating..." : "Create group"}
                </button>
              </div>
            </div>
        </Modal>
      )}

      {/* Join Group Modal */}
      {joinModalOpen && (
        <Modal onClose={closeModals} as="form" onSubmit={handleJoinGroup}>
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
                <button type="submit" className="primary-button" disabled={submitting} aria-busy={submitting}>{submitting && <BusySpinner />}
                  {submitting ? "Joining..." : "Join group"}
                </button>
              </div>
            </div>
        </Modal>
      )}

      {confirmDialog}
      </ShellOverlays>
    </AppShell>
  );
}
