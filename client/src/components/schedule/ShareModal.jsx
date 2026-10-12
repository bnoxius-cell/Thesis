import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Copy, RefreshCw, Send, Link2, Lock, Globe2, UserPlus, ShieldCheck } from "lucide-react";
import UserAvatar from "../UserAvatar";
import { shareLinkFor } from "../../utils/scheduleUtils";
import Modal from "../Modal";

const ROLE_HELP = {
  viewer: "Viewers see the schedule and every change as it happens. They can make their own copy.",
  editor: "Editors change classes, exams and days off for everyone on it.",
};

// Works like Google Docs sharing. People with access get a role (viewer or editor), and
// general access decides whether a code or link opens it too. The owner can let editors
// manage this, and can make the schedule private again in one step.
//
// Each change returns the updated schedule, which goes straight up to the page.
export default function ShareModal({ schedule, backendUrl, currentUserId, onUpdated, onClose }) {
  const [friends, setFriends] = useState([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [pickedFriend, setPickedFriend] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState([]);
  const [pickedGroup, setPickedGroup] = useState("");
  const [confirmPrivate, setConfirmPrivate] = useState(false);

  const isOwner = schedule.role === "owner";
  const base = `${backendUrl}/api/schedules/${schedule._id}`;
  const ownerId = schedule.owner?._id;
  const onIt = new Set([ownerId, ...schedule.collaborators.map((c) => c.user._id)]);
  const available = friends.filter((f) => !onIt.has(f._id));
  const access = schedule.shareCode ? "code" : "restricted";

  useEffect(() => {
    let cancelled = false;
    axios.get(`${backendUrl}/api/friends`, { withCredentials: true })
      .then(({ data }) => { if (!cancelled && data.success) setFriends(data.friends); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFriendsLoaded(true); });
    return () => { cancelled = true; };
  }, [backendUrl]);

  // Only the owner can post their own schedule into a group chat.
  useEffect(() => {
    if (!isOwner) return undefined;
    let cancelled = false;
    axios.get(`${backendUrl}/api/groups`, { withCredentials: true })
      .then(({ data }) => { if (!cancelled && data.success) setGroups(data.groups); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [backendUrl, isOwner]);

  // Runs one request, reports failures the same way everywhere, and hands the fresh
  // schedule to the page on success.
  const run = async (request, successMessage) => {
    setBusy(true);
    try {
      const { data } = await request();
      if (data.success) {
        if (data.schedule) onUpdated(data.schedule);
        if (successMessage) toast.success(successMessage);
        return true;
      }
      toast.error(data.message || "Something went wrong.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
    return false;
  };

  const addPerson = async () => {
    if (!pickedFriend) return;
    const ok = await run(
      () => axios.post(`${base}/share`, { userId: pickedFriend, role: newRole }, { withCredentials: true }),
      newRole === "editor" ? "Added. They can edit it with you." : "Shared. They can see it now.",
    );
    if (ok) setPickedFriend("");
  };

  const changeRole = (person, value) => {
    if (value === "remove") {
      return run(() => axios.delete(`${base}/share/${person._id}`, { withCredentials: true }), `${person.name} no longer has access.`);
    }
    return run(() => axios.post(`${base}/share`, { userId: person._id, role: value }, { withCredentials: true }),
      value === "editor" ? `${person.name} can edit now.` : `${person.name} can view now.`);
  };

  const setAccess = (value) => (value === "restricted"
    ? run(() => axios.put(`${base}/share-code`, { enabled: false }, { withCredentials: true }), "Only people you added can open it now.")
    : run(() => axios.put(`${base}/share-code`, { enabled: true }, { withCredentials: true }), "Anyone with the code or link can open it now."));

  const setCodeRole = (role) => run(
    () => axios.put(`${base}/share-code`, { role }, { withCredentials: true }),
    role === "editor" ? "The code now lets people edit." : "The code now lets people view.",
  );

  const toggleEditorsShare = (checked) => run(
    () => axios.put(base, { editorsCanShare: checked }, { withCredentials: true }),
    checked ? "Editors can share it now." : "Only you can share it now.",
  );

  const makePrivate = async () => {
    const ok = await run(() => axios.post(`${base}/make-private`, {}, { withCredentials: true }), "It's private now. Only you can open it.");
    if (ok) setConfirmPrivate(false);
  };

  // Posts a snapshot into a group chat. Members tap it to add a copy to their own schedules.
  const postToGroup = async () => {
    if (!pickedGroup) return;
    const name = groups.find((g) => g._id === pickedGroup)?.name || "the group";
    const ok = await run(
      () => axios.post(`${backendUrl}/api/groups/${pickedGroup}/messages`, { scheduleId: schedule._id }, { withCredentials: true }),
      `Posted a copy in ${name}.`,
    );
    if (ok) setPickedGroup("");
  };

  const copy = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.info(text);
    }
  };

  const people = [
    { user: schedule.owner, role: "owner" },
    ...schedule.collaborators,
  ].filter((p) => p.user);

  return (
    <Modal onClose={onClose} busy={busy} className="sched-modal share-modal" labelledBy="share-title">
        <div className="modal-header">
          <h2 id="share-title">Share "{schedule.title}"</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <section className="share-block" aria-labelledby="share-add-heading">
          <h3 id="share-add-heading"><UserPlus size={17} aria-hidden="true" /> Add people</h3>
          {friendsLoaded && friends.length === 0 ? (
            <p className="sched-hint">Add some friends first, or turn on the code below and send that instead.</p>
          ) : (
            <div className="share-add-row">
              <select value={pickedFriend} onChange={(e) => setPickedFriend(e.target.value)} aria-label="Choose a friend" disabled={!friendsLoaded || available.length === 0}>
                <option value="">{available.length === 0 && friendsLoaded ? "All your friends are on it" : "Choose a friend"}</option>
                {available.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
              <select className="share-role-select" value={newRole} onChange={(e) => setNewRole(e.target.value)} aria-label="Their role">
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button type="button" className="primary-button" onClick={addPerson} disabled={busy || !pickedFriend}>Share</button>
            </div>
          )}
          <p className="sched-hint">{ROLE_HELP[newRole]}</p>
        </section>

        <section className="share-block" aria-labelledby="share-people-heading">
          <h3 id="share-people-heading">People with access</h3>
          <ul className="share-people">
            {people.map(({ user, role }) => {
              const isMe = user._id === currentUserId;
              return (
                <li key={user._id}>
                  <UserAvatar name={user.name} src={user.avatar} size={36} />
                  <span className="share-person">
                    <strong>{user.name}{isMe && " (you)"}</strong>
                    {role === "owner" && <small>Created this schedule</small>}
                  </span>
                  {role === "owner" || isMe ? (
                    <span className="share-role-static">{role === "owner" ? "Owner" : role === "editor" ? "Editor" : "Viewer"}</span>
                  ) : (
                    <select
                      className="share-role-select"
                      value={role}
                      onChange={(e) => changeRole(user, e.target.value)}
                      aria-label={`${user.name}'s access`}
                      disabled={busy}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="remove">Remove access</option>
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="share-block" aria-labelledby="share-general-heading">
          <h3 id="share-general-heading">General access</h3>
          <div className="share-general">
            <span className={`share-general-icon${access === "code" ? " is-open" : ""}`} aria-hidden="true">
              {access === "code" ? <Globe2 size={20} /> : <Lock size={20} />}
            </span>
            <div className="share-general-body">
              <div className="share-general-row">
                <select value={access} onChange={(e) => setAccess(e.target.value)} aria-label="Who can open it" disabled={busy}>
                  <option value="restricted">Restricted</option>
                  <option value="code">Anyone with the code or link</option>
                </select>
                {access === "code" && (
                  <select className="share-role-select" value={schedule.shareRole === "editor" ? "editor" : "viewer"} onChange={(e) => setCodeRole(e.target.value)} aria-label="What the code allows" disabled={busy}>
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                )}
              </div>
              <p className="sched-hint">
                {access === "restricted"
                  ? "Only the people above can open it."
                  : schedule.shareRole === "editor"
                    ? "Anyone who opens the link or types the code can edit it. Only send it to people you trust."
                    : "Anyone who opens the link or types the code can see it and make their own copy."}
              </p>
              {access === "code" && (
                <div className="share-code-row">
                  <strong className="sched-code">{schedule.shareCode}</strong>
                  <button type="button" className="sched-icon-button" onClick={() => copy(schedule.shareCode, "Code copied.")} aria-label="Copy the code">
                    <Copy size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="sched-icon-button"
                    onClick={() => run(() => axios.put(`${base}/share-code`, { regenerate: true }, { withCredentials: true }), "New code made. The old code and link stop working.")}
                    aria-label="Make a new code"
                    title="Make a new code"
                    disabled={busy}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {isOwner && (
          <section className="share-block" aria-labelledby="share-settings-heading">
            <h3 id="share-settings-heading"><ShieldCheck size={17} aria-hidden="true" /> Owner settings</h3>
            <label className="sched-check sched-workload-toggle">
              <input type="checkbox" checked={schedule.editorsCanShare === true} onChange={(e) => toggleEditorsShare(e.target.checked)} disabled={busy} />
              <span>
                Editors can add people and change access
                <small>Off means only you decide who sees or edits it.</small>
              </span>
            </label>
            {(schedule.collaborators.length > 0 || schedule.shareCode) && (
              confirmPrivate ? (
                <div className="share-private-confirm" role="alert">
                  <span>
                    {schedule.collaborators.length > 0
                      ? `Remove all ${schedule.collaborators.length} ${schedule.collaborators.length === 1 ? "person" : "people"} and turn off the code? They'll be told. Copies they made stay theirs.`
                      : "Turn off the code so nobody new can open it?"}
                  </span>
                  <div>
                    <button type="button" className="secondary-button small" onClick={() => setConfirmPrivate(false)} disabled={busy}>Keep sharing</button>
                    <button type="button" className="primary-button small" onClick={makePrivate} disabled={busy}>Make private</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="secondary-button share-private" onClick={() => setConfirmPrivate(true)} disabled={busy}>
                  <Lock size={16} aria-hidden="true" /> Make private
                </button>
              )
            )}
          </section>
        )}

        {isOwner && groups.length > 0 && (
          <section className="share-block" aria-labelledby="share-group-heading">
            <h3 id="share-group-heading">Post a copy in a group chat</h3>
            <p className="sched-hint">Group members can add the classes they want to their own schedules. Later changes here don't reach that copy.</p>
            <div className="share-add-row">
              <select value={pickedGroup} onChange={(e) => setPickedGroup(e.target.value)} aria-label="Choose a group">
                <option value="">Choose a group</option>
                {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
              </select>
              <button type="button" className="secondary-button" onClick={postToGroup} disabled={busy || !pickedGroup}>
                <Send size={16} aria-hidden="true" /> Post
              </button>
            </div>
          </section>
        )}

        <div className="modal-actions sched-modal-actions share-footer">
          {schedule.shareCode && (
            <button type="button" className="secondary-button share-copy-link" onClick={() => copy(shareLinkFor(schedule.shareCode), "Link copied.")}>
              <Link2 size={16} aria-hidden="true" /> Copy link
            </button>
          )}
          <button type="button" className="primary-button" onClick={onClose}>Done</button>
        </div>
    </Modal>
  );
}
