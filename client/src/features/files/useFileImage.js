import { useCallback, useEffect, useState } from "react";
import { ensureLink, forgetLink, linkUrl, loadThumb } from "@/shared/lib/fileLinks";

// A stored photo for an <img>. `variant` is "thumb" (the small preview, asked for in groups) or
// "file" (the full photo). `enabled` waits, for a preview that hasn't scrolled into view.
//   src      the link, only once it is ready; read from the link cache on every render, so a link is
//            never kept in state
//   status   "loading" | "ready" | "failed"
//   message  why it failed, in the server's words, when it said
//   onError  for <img onError>: asks for a fresh link once, then gives up
//   retry    asks again after a failure
export default function useFileImage(id, variant, enabled = true) {
  const [state, setState] = useState(() => ({ status: linkUrl(id, variant) ? "ready" : "loading", message: "", attempt: 0 }));

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    const ready =
      variant === "thumb"
        ? loadThumb(id).then((ok) => (ok ? {} : { error: "" }))
        : ensureLink(id, variant);
    ready.then(({ error }) => {
      if (live) setState((prev) => ({ ...prev, status: error === undefined ? "ready" : "failed", message: error ?? "" }));
    });
    return () => {
      live = false;
    };
  }, [id, variant, enabled, state.attempt]);

  const askAgain = useCallback(() => {
    forgetLink(id, variant);
    setState((prev) => ({ status: "loading", message: "", attempt: prev.attempt + 1 }));
  }, [id, variant]);

  const onError = useCallback(() => {
    setState((prev) => ({ ...prev, status: "failed" }));
    if (state.attempt === 0) askAgain();
  }, [askAgain, state.attempt]);

  return {
    src: state.status === "ready" ? linkUrl(id, variant) : null,
    status: state.status,
    message: state.message,
    onError,
    retry: askAgain,
  };
}
