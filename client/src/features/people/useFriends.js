import { useCallback, useState } from "react";
import {
  acceptRequest, dropRequest, fetchFriends, fetchIncoming, fetchSent, removeFriend, requestByCode,
} from "@/shared/api/friends";
import usePolling from "@/shared/hooks/usePolling";
import { useUnread } from "@/app/shell/unreadContext";
import { byName, runFriendAction } from "./friendAction";

const POLL_MS = 30000;
const LOADING = { friends: null, incoming: null, sent: null, status: "loading", error: "" };

// The student's friends and both kinds of request, refreshed every 30 seconds while the tab is in
// front.
//   friends, incoming, sent   null until the first answer; friends are sorted by name
//   status                    "loading" | "ready" | "failed" (failed only when nothing has loaded yet)
//   busyId                    the request or friend being changed right now ("add" for the code form)
//   reload                    tries the first load again
//   accept(request), decline(request), cancel(request), remove(friend), addByCode(code)
//                             each answers true once done; a toast says why when it fails
// A change shows on screen at once, then the lists and the shell's badges are refreshed.
export default function useFriends() {
  const { refresh: refreshUnread } = useUnread();
  const [state, setState] = useState(LOADING);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const results = await Promise.all([fetchFriends(), fetchIncoming(), fetchSent()]);
    const failed = results.find((res) => res.error);
    setState((prev) => {
      if (failed) return prev.friends ? prev : { ...LOADING, status: "failed", error: failed.error };
      const [friends, incoming, sent] = results;
      return {
        friends: [...(friends.data.friends ?? [])].sort(byName),
        incoming: incoming.data.requests ?? [],
        sent: sent.data.requests ?? [],
        status: "ready",
        error: "",
      };
    });
  }, []);

  usePolling(load, POLL_MS);

  const reload = useCallback(() => {
    setState(LOADING);
    load();
  }, [load]);

  // `update(prev)` returns the lists to show straight away.
  const act = useCallback(async (id, request, done, update) => {
    setBusyId(id);
    const data = await runFriendAction(request, done);
    setBusyId(null);
    if (!data) return false;
    if (update) setState((prev) => ({ ...prev, ...update(prev) }));
    load();
    refreshUnread();
    return true;
  }, [load, refreshUnread]);

  const accept = (request) => act(
    request._id,
    () => acceptRequest(request._id),
    () => `You and ${request.user.name} are now friends.`,
    (prev) => ({
      incoming: prev.incoming.filter((r) => r._id !== request._id),
      friends: [...prev.friends, request.user].sort(byName),
    }),
  );
  const decline = (request) => act(
    request._id,
    () => dropRequest(request._id),
    () => "Request declined.",
    (prev) => ({ incoming: prev.incoming.filter((r) => r._id !== request._id) }),
  );
  const cancel = (request) => act(
    request._id,
    () => dropRequest(request._id),
    () => "Request cancelled.",
    (prev) => ({ sent: prev.sent.filter((r) => r._id !== request._id) }),
  );
  const remove = (friend) => act(
    friend._id,
    () => removeFriend(friend._id),
    () => "Friend removed.",
    (prev) => ({ friends: prev.friends.filter((f) => f._id !== friend._id) }),
  );
  const addByCode = (code) => act(
    "add",
    () => requestByCode(code),
    (data) => (data.accepted ? "You're now friends." : "Friend request sent."),
  );

  return { ...state, busyId, reload, accept, decline, cancel, remove, addByCode };
}
