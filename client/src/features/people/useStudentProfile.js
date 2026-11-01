import { useCallback, useState } from "react";
import { acceptRequest, dropRequest, removeFriend, requestByUser } from "@/shared/api/friends";
import { fetchProfile } from "@/shared/api/user";
import usePolling from "@/shared/hooks/usePolling";
import { useAuth } from "@/pages/authentication/AuthContext";
import { useUnread } from "@/app/shell/unreadContext";
import { runFriendAction } from "./friendAction";

const POLL_MS = 30000;
const LOADING = { profile: null, status: "loading", error: "" };

// Another student's profile, refreshed every 30 seconds while the tab is in front so a request they
// answer shows up.
//   profile  null until it loads
//   status   "loading" | "ready" | "unavailable" (no such student, or none the student may see:
//            `error` has the server's words) | "failed" (a network or server problem, retry helps)
//   isSelf   true for the student's own profile, which gets no actions
//   busy     a change is in flight
//   add(), accept(), decline(), remove()   each toasts the outcome and refreshes the profile
export default function useStudentProfile(userId) {
  const { userData } = useAuth();
  const { refresh: refreshUnread } = useUnread();
  const [state, setState] = useState(LOADING);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error, status } = await fetchProfile(userId);
    setState((prev) => {
      if (data) return { profile: data.profile, status: "ready", error: "" };
      if (prev.profile) return prev;
      const gone = status === 403 || status === 404;
      return { profile: null, status: gone ? "unavailable" : "failed", error };
    });
  }, [userId]);

  usePolling(load, POLL_MS);

  const retry = useCallback(() => {
    setState(LOADING);
    load();
  }, [load]);

  const act = useCallback(async (request, done) => {
    setBusy(true);
    const data = await runFriendAction(request, done);
    if (data) {
      await load();
      refreshUnread();
    }
    setBusy(false);
  }, [load, refreshUnread]);

  const { profile } = state;
  return {
    ...state,
    isSelf: Boolean(profile && userData?._id === profile._id),
    busy,
    retry,
    add: () => act(() => requestByUser(userId), (data) => (data.accepted ? "You're now friends." : "Friend request sent.")),
    accept: () => act(() => acceptRequest(profile.requestId), () => "You're now friends."),
    decline: () => act(() => dropRequest(profile.requestId), () => "Request declined."),
    remove: () => act(() => removeFriend(userId), () => "Friend removed."),
  };
}
