import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPreferences, savePreferences } from "@/shared/api/notifications";

// The student's notification switches. `setPref` flips at once and saves just that key; if the save
// fails the switch flips back and `errors[key]` says why. `savedKey` names the switch that just
// saved, for a moment, so its row can say "Saved".
const SHOWN_MS = 1600;

export default function useNotificationPrefs() {
  const [prefs, setPrefs] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState({});
  const [savedKey, setSavedKey] = useState("");
  const current = useRef(null);
  const timer = useRef(0);
  current.current = prefs;

  useEffect(() => () => clearTimeout(timer.current), []);

  const load = useCallback(async () => {
    setLoadError("");
    const { data, error } = await fetchPreferences();
    if (data) setPrefs(data.preferences);
    else setLoadError(error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setPref = useCallback(
    async (key, value) => {
      const previous = current.current[key];
      setErrors((e) => ({ ...e, [key]: "" }));
      setSavedKey("");
      setPrefs((p) => ({ ...p, [key]: value }));
      const { data, error } = await savePreferences({ [key]: value });
      if (data) {
        setSavedKey(key);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setSavedKey(""), SHOWN_MS);
        return;
      }
      setPrefs((p) => ({ ...p, [key]: previous }));
      setErrors((e) => ({ ...e, [key]: error || "Couldn't save. Try again." }));
    },
    [],
  );

  return { prefs, loadError, errors, savedKey, setPref, reload: load };
}
