import { Button, Segment, Skeleton, Switch } from "@/shared/ui";
import SettingsRow, { SettingsGroup } from "./SettingsRow";

const TOPICS = [
  { key: "taskReminders", label: "Task reminders" },
  { key: "friendActivity", label: "Friend requests and accepts" },
  { key: "scheduleShares", label: "Timetables shared with me" },
  { key: "groupMessages", label: "Group messages" },
  { key: "groupTasks", label: "Shared tasks in groups" },
  { key: "groupMembers", label: "People joining or leaving my groups" },
];

const LEAD_TIMES = [
  { value: 3, label: "3 hours" },
  { value: 24, label: "1 day" },
  { value: 48, label: "2 days" },
];

// "Tell me about": one switch per kind of news. The switches stop the inbox rows as well as the
// alerts, so the copy says what the student gets.
export default function NotificationSwitches({ state }) {
  const { prefs, loadError, errors, setPref, reload } = state;

  if (loadError) {
    return (
      <SettingsGroup title="Notifications">
        <div className="settings-row">
          <p className="settings-row__text">{loadError}</p>
          <Button variant="secondary" size="sm" onClick={reload}>Try again</Button>
        </div>
      </SettingsGroup>
    );
  }
  if (!prefs) {
    return (
      <SettingsGroup title="Notifications">
        <Skeleton height={44} />
      </SettingsGroup>
    );
  }

  return (
    <SettingsGroup title="Notifications">
      <p className="settings-group__lead">Tell me about</p>
      {TOPICS.map(({ key, label }) => (
        <div key={key}>
          <SettingsRow label={label} error={errors[key]}>
            {(labelId) => <Switch labelId={labelId} checked={prefs[key]} onChange={(on) => setPref(key, on)} />}
          </SettingsRow>
          {key === "taskReminders" && (
            <div className="settings-row settings-row--sub">
              <span id="lead-label" className="settings-row__hint">How early</span>
              <Segment
                labelId="lead-label"
                options={LEAD_TIMES}
                value={prefs.reminderLeadHours}
                disabled={!prefs.taskReminders}
                onChange={(hours) => setPref("reminderLeadHours", hours)}
              />
              {errors.reminderLeadHours && <p className="settings-row__error" role="alert">{errors.reminderLeadHours}</p>}
            </div>
          )}
        </div>
      ))}
      <p className="settings-group__note">To mute one group, open it and use Info.</p>
    </SettingsGroup>
  );
}
