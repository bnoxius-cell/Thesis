import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { BellRing, BellOff } from "lucide-react";
import { useAuth } from "../pages/authentication/AuthContext";
import { disablePush, enablePush, getPushStatus } from "../utils/pushClient";

const LEAD_OPTIONS = [
  { value: 3, label: "3 hours before" },
  { value: 24, label: "1 day before" },
  { value: 48, label: "2 days before" },
];

const GROUP_LEVELS = [
  { value: "all", label: "Everything" },
  { value: "tasks", label: "Shared tasks only" },
  { value: "muted", label: "Muted" },
];

const DEVICE_COPY = {
  unsupported: "This browser can't show alerts when the site is closed. You'll still see everything in your inbox here.",
  install: "On iPhone and iPad, add StressCare to your Home Screen first (Share, then Add to Home Screen). Open it from there and come back to turn this on.",
  denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back here.",
  off: "Get an alert on this phone or computer, even when StressCare isn't open.",
  on: "On for this device. You'll get alerts even when StressCare is closed.",
};

const REASON_COPY = {
  server: "Device alerts aren't set up on the server yet.",
  dismissed: "No problem. You can turn this on whenever you like.",
  denied: DEVICE_COPY.denied,
  install: DEVICE_COPY.install,
  unsupported: DEVICE_COPY.unsupported,
};

function Switch({ label, hint, checked, onChange, disabled }) {
  return (
    <label className={`pref-row ${disabled ? "is-disabled" : ""}`}>
      <span className="pref-text">
        <span className="pref-label">{label}</span>
        {hint && <span className="pref-hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="pref-switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function NotificationPreferences() {
  const { backendUrl, userData } = useAuth();
  const userId = userData?._id;

  const [prefs, setPrefs] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [deviceBusy, setDeviceBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prefRes, groupRes] = await Promise.all([
          axios.get(`${backendUrl}/api/notifications/preferences`),
          axios.get(`${backendUrl}/api/groups`),
        ]);
        if (cancelled) return;
        if (!prefRes.data.success) throw new Error(prefRes.data.message);
        setPrefs(prefRes.data.preferences);
        setGroups(groupRes.data.success ? groupRes.data.groups : []);
      } catch (err) {
        if (!cancelled) setLoadError(err.response?.data?.message || err.message || "Could not load your settings.");
      }
    })();
    return () => { cancelled = true; };
  }, [backendUrl]);

  useEffect(() => {
    if (!userId) return;
    getPushStatus(userId).then(setDeviceStatus);
  }, [userId]);

  // Optimistic: flip it on screen right away, roll back if the server says no.
  const save = useCallback(async (patch) => {
    const before = prefs;
    setPrefs((p) => ({ ...p, ...patch }));
    try {
      const { data } = await axios.put(`${backendUrl}/api/notifications/preferences`, patch);
      if (!data.success) throw new Error(data.message);
      setPrefs(data.preferences);
    } catch (err) {
      setPrefs(before);
      toast.error(err.response?.data?.message || err.message || "Couldn't save that change.");
    }
  }, [backendUrl, prefs]);

  const levelFor = (groupId) => prefs.groupOverrides.find((o) => o.group === groupId)?.level || "all";

  const setGroupLevel = (groupId, level) => {
    const rest = prefs.groupOverrides.filter((o) => o.group !== groupId);
    save({ groupOverrides: level === "all" ? rest : [...rest, { group: groupId, level }] });
  };

  const toggleDevice = async () => {
    setDeviceBusy(true);
    try {
      if (deviceStatus === "on") {
        await disablePush(backendUrl, userId);
        setDeviceStatus("off");
        toast.success("Device alerts are off.");
      } else {
        const result = await enablePush(backendUrl, userId);
        if (result.ok) {
          setDeviceStatus("on");
          toast.success("Device alerts are on.");
        } else {
          toast.info(REASON_COPY[result.reason] || "Couldn't turn on device alerts.");
          setDeviceStatus(await getPushStatus(userId));
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't change device alerts. Try again.");
    } finally {
      setDeviceBusy(false);
    }
  };

  if (loadError) {
    return (
      <section className="panel" id="notification-settings">
        <p className="schedule-empty">{loadError}</p>
      </section>
    );
  }
  if (!prefs) {
    return (
      <section className="panel" id="notification-settings">
        <p className="schedule-empty">Loading your settings...</p>
      </section>
    );
  }

  const canToggleDevice = deviceStatus === "off" || deviceStatus === "on";

  return (
    <section className="panel" id="notification-settings">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Preferences</span>
          <h2>What you get notified about</h2>
        </div>
      </div>

      <div className="pref-group">
        <h3>On this device</h3>
        <div className="pref-device">
          <span className="pref-device-icon" aria-hidden="true">
            {deviceStatus === "on" ? <BellRing size={20} /> : <BellOff size={20} />}
          </span>
          <p>{deviceStatus ? DEVICE_COPY[deviceStatus] : "Checking this device..."}</p>
          {canToggleDevice && (
            <button
              type="button"
              className={deviceStatus === "on" ? "secondary-button small" : "primary-button small"}
              onClick={toggleDevice}
              disabled={deviceBusy}
            >
              {deviceStatus === "on" ? "Turn off" : "Turn on"}
            </button>
          )}
        </div>
      </div>

      <div className="pref-group">
        <h3>Tasks</h3>
        <Switch
          label="Deadline reminders"
          hint="A heads up when an unfinished task is coming due."
          checked={prefs.taskReminders}
          onChange={(v) => save({ taskReminders: v })}
        />
        <label className={`pref-row ${prefs.taskReminders ? "" : "is-disabled"}`}>
          <span className="pref-text">
            <span className="pref-label">Remind me</span>
          </span>
          <select
            className="pref-select"
            value={prefs.reminderLeadHours}
            disabled={!prefs.taskReminders}
            onChange={(e) => save({ reminderLeadHours: Number(e.target.value) })}
          >
            {LEAD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <div className="pref-group">
        <h3>Friends and sharing</h3>
        <Switch
          label="Friend requests"
          hint="New requests, and when someone accepts yours."
          checked={prefs.friendActivity}
          onChange={(v) => save({ friendActivity: v })}
        />
        <Switch
          label="Shared schedules"
          hint="When a friend shares a schedule with you."
          checked={prefs.scheduleShares}
          onChange={(v) => save({ scheduleShares: v })}
        />
      </div>

      <div className="pref-group">
        <h3>Groups</h3>
        <Switch
          label="Chat messages"
          hint="New messages in your groups. Unread ones from the same group are combined into one."
          checked={prefs.groupMessages}
          onChange={(v) => save({ groupMessages: v })}
        />
        <Switch
          label="Shared tasks"
          hint="When someone in a group shares a task."
          checked={prefs.groupTasks}
          onChange={(v) => save({ groupTasks: v })}
        />
        <Switch
          label="People joining or leaving"
          hint="Members who join a group, and (if you're the admin) who leaves."
          checked={prefs.groupMembers}
          onChange={(v) => save({ groupMembers: v })}
        />

        <h4 className="pref-subhead">Per group</h4>
        {groups.length === 0 ? (
          <p className="pref-hint">Join or create a group and it will show up here, so you can quiet the busy ones.</p>
        ) : (
          groups.map((g) => (
            <label key={g._id} className="pref-row">
              <span className="pref-text">
                <span className="pref-label">{g.name}</span>
              </span>
              <select
                className="pref-select"
                value={levelFor(g._id)}
                onChange={(e) => setGroupLevel(g._id, e.target.value)}
              >
                {GROUP_LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))
        )}
      </div>
    </section>
  );
}
