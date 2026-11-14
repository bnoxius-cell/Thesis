import { useCallback, useEffect, useState } from "react";
import { createDeckFromReviewer, fetchFlashcards } from "@/shared/api/flashcards";

// The id of the deck a reviewer already has (`deckId`, null when none), and the one action on the reviewer
// page: make it. One request when the page opens (the reviewer itself doesn't say), none after: a made deck
// is remembered here. A failed look-up leaves `deckId` null, and the server answers `existing` if a deck was
// there after all.
export default function useReviewerDeck(reviewerId) {
  const [deckId, setDeckId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetchFlashcards().then((result) => {
      if (live && result.data) setDeckId(result.data.sources.find((s) => s.reviewerId === reviewerId)?.deckId ?? null);
    });
    return () => {
      live = false;
    };
  }, [reviewerId]);

  const make = useCallback(async () => {
    setBusy(true);
    setError("");
    const result = await createDeckFromReviewer(reviewerId);
    setBusy(false);
    if (result.error) setError(result.error);
    else setDeckId(result.data.deck.id);
  }, [reviewerId]);

  return { deckId, busy, error, make };
}
