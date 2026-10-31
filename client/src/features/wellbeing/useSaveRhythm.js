import { useCallback, useState } from "react";
import { updateProfile } from "@/shared/api/user";
import { useAuth } from "@/pages/authentication/AuthContext";
import { rhythmPayload } from "./rhythm";

// Saves the rhythm form and refreshes the signed-in user, so the chips, the sleep card and the week
// all read the new numbers. save() answers true when it worked; otherwise `error` holds the server's
// plain message and the dialog stays open.
export default function useSaveRhythm() {
  const { getUserData } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = useCallback(async (form) => {
    setSaving(true);
    setError("");
    const { error: failure } = await updateProfile(rhythmPayload(form));
    if (failure) {
      setError(failure);
      setSaving(false);
      return false;
    }
    await getUserData();
    setSaving(false);
    return true;
  }, [getUserData]);

  return { save, saving, error };
}
