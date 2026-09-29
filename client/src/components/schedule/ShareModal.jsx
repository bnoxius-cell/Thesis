import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Copy, RefreshCw, X } from "lucide-react";

// Owner-only. Two ways in: pick friends directly, or turn on a code anyone can enter.
// Sharing is view-only. It exists so classmates can copy a timetable instead of
// typing their own, so there are no edit permissions to hand out.
// Each call returns the updated schedule, which is passed straight up to the page.
export default function ShareModal({ schedule, backendUrl, onUpdated, onClose }) {
  const [friends, setFriends] = useState([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [pickedFriend, setPickedFriend] = useState("");
  const [busy, setBusy] = useState(false);

  const base = `${backendUrl}/api/schedules/${schedule._id}`;
  const collaboratorIds = new Set(schedule.collaborators.map((c) => c.user._id));
  const available = friends.filter((f) => !collaboratorIds.has(f._id));

  useEffect(() => {
    let cancelled = false;
    axios.get(`${backendUrl}/api/friends`, { withCredentials: true })
      .then(({ data }) => { if (!cancelled && data.success) setFriends(data.friends); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFriendsLoaded(true); });
    return () => { cancelled = true; };
  }, [backendUrl]);

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

  const shareWithFriend = async () => {
    if (!pickedFriend) return;
    const ok = await run(
      () => axios.post(`${base}/share`, { userId: pickedFriend }, { withCredentials: true }),
      "Shared. They'll see it under their schedules."
    );
    if (ok) setPickedFriend("");
  };

  const remove = (userId) =>
    run(() => axios.delete(`${base}/share/${userId}`, { withCredentials: true }), "Removed.");

  const updateCode = (body, message) =>
    run(() => axios.put(`${base}/share-code`, body, { withCredentials: true }), message);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(schedule.shareCode);
      toast.success("Code copied.");
    } catch {
      toast.info(`Your code is ${schedule.shareCode}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content sched-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share "{schedule.title}"</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <section className="sched-share-section">
          <h3>Friends</h3>
          <p className="sched-hint">They can view your schedule and copy it, so nobody has to type theirs from scratch. They cannot change yours.</p>
          {friendsLoaded && friends.length === 0 ? (
            <p className="sched-hint">Add some friends first, or share with a code below.</p>
          ) : (
            <div className="sched-share-add">
              <select value={pickedFriend} onChange={(e) => setPickedFriend(e.target.value)} aria-label="Choose a friend" disabled={!friendsLoaded || available.length === 0}>
                <option value="">{available.length === 0 && friendsLoaded ? "Everyone has access" : "Choose a friend"}</option>
                {available.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
              <button type="button" className="primary-button" onClick={shareWithFriend} disabled={busy || !pickedFriend}>
                Share
              </button>
            </div>
          )}

          {schedule.collaborators.length > 0 && (
            <ul className="sched-people">
              {schedule.collaborators.map(({ user }) => (
                <li key={user._id}>
                  <span className="sched-person-name">{user.name}</span>
                  <span className="sched-person-role">Can copy</span>
                  <button type="button" className="sched-icon-button" onClick={() => remove(user._id)} aria-label={`Remove ${user.name}`} disabled={busy}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sched-share-section">
          <h3>Share code</h3>
          {schedule.shareCode ? (
            <>
              <div className="sched-code-row">
                <strong className="sched-code">{schedule.shareCode}</strong>
                <button type="button" className="sched-icon-button" onClick={copyCode} aria-label="Copy code"><Copy size={16} aria-hidden="true" /></button>
                <button type="button" className="sched-icon-button" onClick={() => updateCode({ regenerate: true }, "New code created. The old one no longer works.")} aria-label="Make a new code" disabled={busy}>
                  <RefreshCw size={16} aria-hidden="true" />
                </button>
              </div>
              <p className="sched-hint">Anyone with the code can view this schedule and copy it into their own.</p>
              <div className="sched-share-add">
                <button type="button" className="secondary-button" onClick={() => updateCode({ enabled: false }, "Code turned off.")} disabled={busy}>
                  Turn off
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="sched-hint">Anyone you give the code to can view this schedule and copy it. They enter it under "Join with a code".</p>
              <button type="button" className="secondary-button" onClick={() => updateCode({ enabled: true }, "Code created.")} disabled={busy}>
                Create a code
              </button>
            </>
          )}
        </section>

        <div className="modal-actions sched-modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
