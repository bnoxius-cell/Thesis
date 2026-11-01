import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { X, ShieldCheck, Check, Copy, LogOut, Trash2, Pin } from "lucide-react";
import PictureField from "../PictureField";
import UserAvatar from "../UserAvatar";
import { useAuth } from "../../pages/authentication/AuthContext";
import Modal from "../Modal";
import BusySpinner from "../BusySpinner";

// Everything about the group that isn't the conversation: the join code, who is in it and, for
// the owner and admins, the name, picture and chat filter. Leave (members) and Delete (owner)
// live at the bottom, so the group list carries no destructive buttons.
export default function GroupSettingsDialog({ group, onClose, onGroupUpdated, onOpenMember, onEditPinned, onLeave, onDelete }) {
  const { backendUrl, user } = useAuth();
  const myId = user?._id;
  const isOwner = group.admin?._id === myId;
  const isAdmin = isOwner || (group.admins || []).includes(myId);
  const roleOf = (id) => (group.admin?._id === id ? "Owner" : (group.admins || []).includes(id) ? "Admin" : null);

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || "");
  const [icon, setIcon] = useState(group.icon || "");
  const [familyFriendly, setFamilyFriendly] = useState(Boolean(group.familyFriendly));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await axios.patch(
        `${backendUrl}/api/groups/${group._id}`,
        { name: name.trim(), description: description.trim(), icon, familyFriendly },
        { withCredentials: true }
      );
      if (data.success) {
        onGroupUpdated(data.group);
        toast.success("Group updated.");
        onClose();
      } else {
        setError(data.message || "Couldn't save the changes.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save the changes.");
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(group.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(`Join code: ${group.joinCode}`);
    }
  };

  // Close this dialog first so the next one (member card, confirm) opens on its own.
  const then = (next, ...args) => () => {
    onClose();
    next(...args);
  };

  return (
    <Modal onClose={onClose} labelledBy="settings-title" className="group-info-dialog">
      <div className="modal-header">
        <h2 id="settings-title">{isAdmin ? "Group settings" : "Group info"}</h2>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>

      <div className="group-info">
        {!isAdmin && group.description && <p className="group-info-desc">{group.description}</p>}

        <section className="group-info-block" aria-labelledby="group-code-label">
          <h3 id="group-code-label">Join code</h3>
          <div className="group-code-row">
            <code className="group-code">{group.joinCode}</code>
            <button type="button" className="secondary-button small" onClick={copyCode}>
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <small className="field-hint">Share it so classmates can join.</small>
        </section>

        <section className="group-info-block" aria-labelledby="group-members-label">
          <h3 id="group-members-label">Members ({group.members.length})</h3>
          <ul className="group-members">
            {group.members.map((member) => (
              <li key={member._id}>
                <button type="button" className="group-member-btn" onClick={then(onOpenMember, member._id)}>
                  <UserAvatar name={member.name} src={member.avatar} size={32} />
                  <span>{member.name}{member._id === myId ? " (you)" : ""}</span>
                  {roleOf(member._id) && <em className={`role-pill role-${roleOf(member._id).toLowerCase()}`}>{roleOf(member._id)}</em>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {isAdmin && (
          <section className="group-info-block" aria-labelledby="group-pinned-label">
            <h3 id="group-pinned-label">Pinned note</h3>
            {group.pinned?.text ? (
              <p className="group-info-pinned">{group.pinned.text}</p>
            ) : (
              <small className="field-hint">Nothing pinned. A note shows at the top of the group for everyone.</small>
            )}
            <div>
              <button type="button" className="secondary-button small" onClick={then(onEditPinned)}>
                <Pin size={16} aria-hidden="true" /> {group.pinned?.text ? "Edit note" : "Pin a note"}
              </button>
            </div>
          </section>
        )}

        {isAdmin && (
          <form className="group-info-block group-info-form" onSubmit={save} aria-labelledby="group-details-label">
            <h3 id="group-details-label">Details</h3>
            <div className="form-group">
              <span className="field-label">Group icon</span>
              <PictureField value={icon} onChange={setIcon} name={name} square size={72} chooseLabel="Choose an image" />
            </div>
            <div className="form-group">
              <label htmlFor="settings-name">Group name</label>
              <input id="settings-name" type="text" value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setError(""); }} />
            </div>
            <div className="form-group">
              <label htmlFor="settings-desc">Description</label>
              <input id="settings-desc" type="text" value={description} maxLength={140} onChange={(e) => setDescription(e.target.value)} placeholder="What's this group for?" />
            </div>

            <label className="switch-row">
              <input type="checkbox" checked={familyFriendly} onChange={(e) => setFamilyFriendly(e.target.checked)} />
              <span>
                <strong><ShieldCheck size={15} aria-hidden="true" /> Family-friendly chat</strong>
                <small>Messages with swearing or explicit words are stopped before they reach the group. Shared tasks and schedules are checked too.</small>
              </span>
            </label>

            {error && <p className="form-error">{error}</p>}
            <div className="group-info-save">
              <button type="submit" className="primary-button" disabled={saving} aria-busy={saving}>{saving && <BusySpinner />}
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}

        <div className="group-info-leave">
          {isOwner ? (
            <button type="button" className="ghost-button is-danger" onClick={then(onDelete)}>
              <Trash2 size={16} aria-hidden="true" /> Delete group
            </button>
          ) : (
            <button type="button" className="ghost-button is-danger" onClick={then(onLeave)}>
              <LogOut size={16} aria-hidden="true" /> Leave group
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
