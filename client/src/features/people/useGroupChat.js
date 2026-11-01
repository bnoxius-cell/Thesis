import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { fetchMessages, sendMessage } from "@/shared/api/groups";
import usePolling from "@/shared/hooks/usePolling";
import { mergeIncoming, mergeSent } from "./chatMessages";

const POLL_MS = 3000;

// One group's chat. Mount it with a `key` of the group id so a new group starts clean.
//   items    messages in order, with the ones still being sent at the end
//   status   "loading" | "ready" | "failed" | "gone" (the group is no longer there for this student)
//   send     send(text) shows the message at once and answers { ok }. On failure the row goes away
//            and a toast says why, so the caller can put the text back in the box
//   retry    tries the first load again
//   markAdded  markAdded(messageId) flags a shared timetable as added to the student's plan
// It polls every 3 seconds while the tab is in front. `onRead` runs when the server has just marked
// this group's notifications read (on opening the chat and when new messages arrive).
export default function useGroupChat(groupId, { me, onRead }) {
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const cursor = useRef(null); // { after, since } once there is a message to continue from
  const busy = useRef(false);
  const opened = useRef(false); // true once the first answer is in: later arrivals are "fresh"
  const sent = useRef(0);

  const poll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const res = await fetchMessages(groupId, cursor.current);
    busy.current = false;

    if (!res.data) {
      if (res.status === 404) setStatus("gone");
      // A blip while the chat is open is ignored: the next poll tries again.
      else if (!opened.current) {
        setError(res.error);
        setStatus("failed");
      }
      return;
    }

    const { messages: incoming, serverTime: time, readNotifications } = res.data;
    // Only polled messages move the cursor: if our own send did, a message a teammate posted just
    // before ours would be skipped.
    const newest = incoming[incoming.length - 1]?._id ?? cursor.current?.after;
    cursor.current = newest ? { after: newest, since: time } : null;
    setMessages((prev) => mergeIncoming(prev, res.data, { fresh: opened.current }));
    opened.current = true;
    setStatus("ready");
    if (readNotifications > 0) onRead?.(groupId);
  }, [groupId, onRead]);

  usePolling(poll, POLL_MS, { enabled: status !== "gone" });

  const send = useCallback(async (text) => {
    sent.current += 1;
    const clientId = `sending-${sent.current}`;
    const row = { clientId, pending: true, fresh: true, type: "text", text, sender: me, createdAt: new Date().toISOString() };
    setPending((prev) => [...prev, row]);

    const res = await sendMessage(groupId, text);
    setPending((prev) => prev.filter((m) => m.clientId !== clientId));
    if (!res.data) {
      toast.error(res.error);
      return { ok: false };
    }
    setMessages((prev) => mergeSent(prev, res.data.message, clientId));
    return { ok: true };
  }, [groupId, me]);

  // A timetable card turns into "In your plan" once its copy is in. Polls don't carry that flag.
  const markAdded = useCallback((messageId) => {
    setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, addedByMe: true } : m)));
  }, []);

  const retry = useCallback(() => {
    setStatus("loading");
    poll();
  }, [poll]);

  const items = useMemo(() => [...messages, ...pending], [messages, pending]);
  return { items, status, error, send, retry, markAdded };
}
