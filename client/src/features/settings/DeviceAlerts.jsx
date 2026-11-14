import { useCallback, useEffect, useState } from "react";
import { Button, Chip } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import { disablePush, enablePush, getPushStatus } from "@/utils/pushClient";
import SettingsRow, { SettingsGroup } from "./SettingsRow";

const OFFLINE = "Can't reach StressCare. Check your connection and try again.";

const HINTS = {
  on: "This device will alert you, even when StressCare is closed.",
  off: "Get alerts on this device, even when StressCare is closed.",
  denied: "Alerts are blocked for this site. Allow notifications in your browser's site settings, then come back.",
  install: "On iPhone, add StressCare to your Home Screen first, then turn alerts on there.",
  unsupported: "This browser can't show alerts.",
};

const FAILED = {
  server: "Alerts aren't set up on this server yet.",
  denied: HINTS.denied,
  dismissed: "Alerts are still off. Choose Allow when your browser asks.",
  install: HINTS.install,
  unsupported: HINTS.unsupported,
};

// Web Push for this browser only: other devices have their own switch.
export default function DeviceAlerts() {
  const { backendUrl, userData } = useAuth();
  const userId = userData?._id;
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => setStatus(await getPushStatus(userId)), [userId]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      if (status === "on") await disablePush(backendUrl, userId);
      else {
        const result = await enablePush(backendUrl, userId);
        if (!result.ok) setError(FAILED[result.reason] ?? FAILED.server);
      }
    } catch {
      setError(OFFLINE);
    }
    await refresh();
    setBusy(false);
  };

  const canToggle = status === "on" || status === "off";
  return (
    <SettingsGroup title="This device">
      <SettingsRow label="Alerts on this device" hint={status && HINTS[status]} error={error}>
        {status && (
          <>
            {status === "on" && <Chip tone="good">On</Chip>}
            {canToggle && (
              <Button variant="secondary" size="sm" busy={busy} onClick={toggle}>
                {status === "on" ? "Turn off" : "Turn on"}
              </Button>
            )}
          </>
        )}
      </SettingsRow>
    </SettingsGroup>
  );
}
