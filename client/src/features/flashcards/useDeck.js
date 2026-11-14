import { useCallback, useEffect, useState } from "react";
import { addCard, deleteCard, deleteDeck, fetchDeck, updateCard, updateDeck } from "@/shared/api/flashcards";

const LOADING = { status: "loading", error: "", deck: null, cards: [], fresh: null };

// One deck and its cards, for one deck id.
//   status    "loading" | "loaded" | "missing" (no such deck, or not theirs) | "failed"
//   error     a plain message for the failed state
//   deck      the deck as the list shows it ({ id, title, course, subject, cards, due, ... })
//   cards     the deck's cards, oldest first ({ id, term, answer })
//   fresh     the id of the card just added, so its row can ease in
//   reload    fetches again behind the skeleton (Try again)
//   add, edit, removeCard, rename, removeDeck   each answers { data } or { error } like the api calls; after a
//             change the deck is fetched again in place, so the title, the counts and the cards always agree
export default function useDeck(deckId) {
  const [state, setState] = useState(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState(LOADING);
    fetchDeck(deckId).then((res) => {
      if (cancelled) return;
      if (res.data) return setState({ ...LOADING, status: "loaded", deck: res.data.deck, cards: res.data.cards });
      const missing = res.fromApi === true && res.status === 404;
      setState({ ...LOADING, status: missing ? "missing" : "failed", error: res.error });
    });
    return () => {
      cancelled = true;
    };
  }, [deckId, attempt]);

  // A failed refresh keeps what is on screen.
  const refresh = useCallback(
    async (fresh = null) => {
      const res = await fetchDeck(deckId);
      if (res.data) setState({ ...LOADING, status: "loaded", deck: res.data.deck, cards: res.data.cards, fresh });
    },
    [deckId],
  );

  const changed = useCallback(
    async (request, fresh) => {
      const res = await request;
      if (!res.error) await refresh(fresh?.(res.data));
      return res;
    },
    [refresh],
  );

  return {
    ...state,
    reload: useCallback(() => setAttempt((n) => n + 1), []),
    add: (fields) => changed(addCard(deckId, fields), (data) => data.card.id),
    edit: (cardId, fields) => changed(updateCard(cardId, fields)),
    removeCard: (cardId) => changed(deleteCard(cardId)),
    rename: (fields) => changed(updateDeck(deckId, fields)),
    removeDeck: () => deleteDeck(deckId),
  };
}
