import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFlashcards } from "@/shared/api/flashcards";

// The Flashcards tab's data, fetched only while `enabled` (the Flashcards side of Practice is showing), so the
// Reviewers side and the other tabs never ask for it. There is no timer: it loads when the side opens and again
// after a save (`refresh`).
//   data     { decks, due, sources, limits } once loaded, else null
//   status   "idle" | "loading" | "ready" | "failed" ("failed" only while there is nothing to show)
//   error    the server's message for the failed state
//   fresh    the id of the deck that was just added, so its row can ease in
//   refresh  fetches again in place; pass the new deck's id to animate its row
export default function useFlashcards({ enabled }) {
  const [state, setState] = useState({ data: null, status: "idle", error: "", fresh: null });
  const live = useRef(true);

  const load = useCallback(async (fresh = null) => {
    const res = await fetchFlashcards();
    if (!live.current) return;
    // A failed refresh keeps what is on screen.
    setState((prev) =>
      res.data
        ? { data: res.data, status: "ready", error: "", fresh }
        : prev.data
          ? { ...prev, status: "ready" }
          : { data: null, status: "failed", error: res.error, fresh: null },
    );
  }, []);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setState((prev) => (prev.data ? prev : { ...prev, status: "loading" }));
    load();
  }, [enabled, load]);

  return { ...state, refresh: load };
}
