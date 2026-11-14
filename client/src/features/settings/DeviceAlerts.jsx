import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import { disablePush, enablePush, getPushStatus } from "@/utils/pushClient";
import SettingsRow, { SettingsGroup } from "./SettingsRow";

const OFFLINE = "Can't reach StressCare. Check your connection and try again.";

// What the row says for each state of this browser (frame 290:518).
const STATES = {
  off: { label: "Alerts on this device", hint: "Get notifications even when StressCare is closed." },
  on: { label: "Alerts on this device", hint: "Alerts are on for this browser." },
  denied: {
    label: "Alerts are blocked",
    hint: "Allow notifications for this site in your browser settings, then come back.",
  },
  install: {
    label: "Add StressCare to your Home Screen first",
    hint: "On iPhone, alerts only work from the Home Screen app. Tap Share, then Add to Home Screen.",
  },
  unsupported: { label: "This browser can't send alerts", hint: "Try Chrome, Edge or Firefox." },
};

const FAILED = {
  server: "Alerts are not set up yet. We are still turning this on. Check back soon.",
  denied: STATES.denied.hint,
  dismissed: "Alerts are still off. Choose Allow when your browser asks.",
  install: STATES.install.hint,
  unsupported: STATES.unsupported.hint,
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

  const { label, hint } = STATES[status] ?? STATES.off;
  const canToggle = status === "on" || status === "off";
  return (
    <SettingsGroup title="This device">
      <SettingsRow label={label} hint={status && hint} error={error}>
        {canToggle && (
          <Button variant={status === "on" ? "secondary" : "primary"} busy={busy} onClick={toggle}>
            {status === "on" ? "Turn off" : "Turn on"}
          </Button>
        )}
      </SettingsRow>
    </SettingsGroup>
  );
}
