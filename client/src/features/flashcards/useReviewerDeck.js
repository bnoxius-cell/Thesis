import { useCallback, useEffect, useState } from "react";
import { createDeckFromReviewer, fetchFlashcards } from "@/shared/api/flashcards";

// Whether a reviewer already has a deck, and the one action on the reviewer page: make it. One request when
// the page opens (the reviewer itself doesn't say), none after: a made deck is remembered here. A failed
// look-up leaves `hasDeck` false, and the server answers `existing` if a deck was there after all.
export default function useReviewerDeck(reviewerId) {
  const [hasDeck, setHasDeck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetchFlashcards().then((result) => {
      if (live && result.data) setHasDeck(result.data.sources.some((s) => s.reviewerId === reviewerId && s.deckId));
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
    else setHasDeck(true);
  }, [reviewerId]);

  return { hasDeck, busy, error, make };
}
