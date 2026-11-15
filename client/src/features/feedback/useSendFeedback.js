import { useCallback, useState } from "react";
import { sendFeedback } from "@/shared/api/feedback";

// Sends the feedback payload. send() answers true when it was saved, or false after a failure, when
// `error` holds the server's plain message and the dialog stays open.
export default function useSendFeedback() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = useCallback(async (payload) => {
    setSending(true);
    setError("");
    const { error: failure } = await sendFeedback(payload);
    setSending(false);
    if (failure) setError(failure);
    return !failure;
  }, []);

  return { send, sending, error };
}
