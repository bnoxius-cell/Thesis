import { useCallback, useState } from "react";
import { updateProfile } from "@/shared/api/user";
import { useAuth } from "@/pages/authentication/AuthContext";

// Saves rhythm fields (a PUT /api/user/profile body) and refreshes the signed-in user, so the chips, the
// sleep card and the week all read the new numbers. save() answers true when it worked; otherwise `error`
// holds the server's plain message.
export default function useSaveRhythm() {
  const { getUserData } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = useCallback(async (fields) => {
    setSaving(true);
    setError("");
    const { error: failure } = await updateProfile(fields);
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
