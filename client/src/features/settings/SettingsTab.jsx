import { useCallback, useEffect, useRef, useState } from "react";
import AppearanceRow from "./AppearanceRow";
import DeviceAlerts from "./DeviceAlerts";
import NotificationSwitches from "./NotificationSwitches";
import useNotificationPrefs from "./useNotificationPrefs";

const SHOWN_MS = 1600;

// Preferences only: Notifications, This device, Appearance. Every change saves the moment it is made,
// and one quiet "Saved" confirms it (a hidden polite region speaks it, the visible word fades).
export default function SettingsTab() {
  const [saved, setSaved] = useState(false);
  const timer = useRef(0);
  const flashSaved = useCallback(() => {
    setSaved(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), SHOWN_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const notifications = useNotificationPrefs(flashSaved);
  return (
    <>
      <p className="settings-saved" data-show={saved || undefined} aria-hidden="true">Saved</p>
      <p className="sr-only" role="status" aria-live="polite">{saved ? "Saved" : ""}</p>
      <NotificationSwitches state={notifications} />
      <DeviceAlerts />
      <AppearanceRow onSaved={flashSaved} />
    </>
  );
}
