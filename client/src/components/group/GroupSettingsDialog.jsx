import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { X, ShieldCheck } from "lucide-react";
import PictureField from "../PictureField";
import { useAuth } from "../../pages/authentication/AuthContext";

// Owner and admins edit the group here: name, description, icon and the family-friendly filter.
export default function GroupSettingsDialog({ group, onClose, onGroupUpdated }) {
  const { backendUrl } = useAuth();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || "");
  const [icon, setIcon] = useState(group.icon || "");
  const [familyFriendly, setFamilyFriendly] = useState(Boolean(group.familyFriendly));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-content" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="modal-header">
          <h2 id="settings-title">Group settings</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="form-grid">
          <div className="form-group full-span">
            <span className="field-label">Group icon</span>
            <PictureField value={icon} onChange={setIcon} name={name} square size={72} chooseLabel="Choose an image" />
          </div>
          <div className="form-group full-span">
            <label htmlFor="settings-name">Group name</label>
            <input id="settings-name" type="text" value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setError(""); }} />
          </div>
          <div className="form-group full-span">
            <label htmlFor="settings-desc">Description</label>
            <input id="settings-desc" type="text" value={description} maxLength={140} onChange={(e) => setDescription(e.target.value)} placeholder="What's this group for?" />
          </div>

          <label className="switch-row full-span">
            <input type="checkbox" checked={familyFriendly} onChange={(e) => setFamilyFriendly(e.target.checked)} />
            <span>
              <strong><ShieldCheck size={15} aria-hidden="true" /> Family-friendly chat</strong>
              <small>Messages with swearing or explicit words are stopped before they reach the group. Shared tasks and schedules are checked too.</small>
            </span>
          </label>

          {error && <p className="form-error full-span">{error}</p>}
          <div className="modal-actions full-span">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-create-task" style={{ width: "auto" }} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
