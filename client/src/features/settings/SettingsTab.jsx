import AppearanceRow from "./AppearanceRow";
import DeviceAlerts from "./DeviceAlerts";
import NotificationSwitches from "./NotificationSwitches";
import useNotificationPrefs from "./useNotificationPrefs";

// Preferences only: Notifications, This device, Appearance. Every change saves the moment it is made.
// The changed row shows "Saved" itself; a hidden polite region speaks it for screen readers.
export default function SettingsTab() {
  const notifications = useNotificationPrefs();
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">{notifications.savedKey ? "Saved" : ""}</p>
      <NotificationSwitches state={notifications} />
      <DeviceAlerts />
      <AppearanceRow />
    </>
  );
}
