import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPreferences, savePreferences } from "@/shared/api/notifications";

// The student's notification switches. `setPref` flips at once and saves just that key; if the save
// fails the switch flips back and `errors[key]` says why. `onSaved` fires after each good save.
export default function useNotificationPrefs(onSaved) {
  const [prefs, setPrefs] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState({});
  const current = useRef(null);
  current.current = prefs;

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
      setPrefs((p) => ({ ...p, [key]: value }));
      const { data, error } = await savePreferences({ [key]: value });
      if (data) {
        onSaved?.();
        return;
      }
      setPrefs((p) => ({ ...p, [key]: previous }));
      setErrors((e) => ({ ...e, [key]: error || "That didn't save. Try again." }));
    },
    [onSaved],
  );

  return { prefs, loadError, errors, setPref, reload: load };
}
