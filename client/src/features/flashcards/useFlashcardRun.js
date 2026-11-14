import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchReview, rateCard } from "@/shared/api/flashcards";

const LOADING = { status: "loading", error: "", cards: [], deck: null, run: 0 };

// A rating that saved: the api answers { data } or { error } and never rejects.
const saved = (outcome) => outcome.status === "fulfilled" && !outcome.value.error;

// The cards of one review run, for one deck id (or every deck when it is empty).
//   status    "loading" | "loaded" | "empty" (nothing to review) | "missing" (no such deck, or not theirs) | "failed"
//   error     a plain message for the missing and failed states
//   cards     [{ id, term, answer }] to study
//   deck      { id, title, course } for a deck run, null across decks
//   run       counts up with every load, so the study screen can be keyed per run
//   reload    tries again
//   rate      rate(card, "got" | "learning") fires the save and returns at once, so the next card never waits
//   finish    waits for every save, tries the failed ones once more, answers { reviewed, got, learning, unsaved }
// Every navigation to the page opens a run once, as the Practice page does.
export default function useFlashcardRun(deckId) {
  const launch = useLocation().key;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState(LOADING);
  const ratings = useRef([]); // { card, rating, promise } for the run on screen
  const finishing = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...LOADING, run: prev.run }));
    ratings.current = [];
    finishing.current = null;
    fetchReview(deckId).then((res) => {
      if (cancelled) return;
      if (res.data) {
        const { cards, deck } = res.data;
        return setState((prev) => ({ ...LOADING, status: cards.length ? "loaded" : "empty", cards, deck, run: prev.run + 1 }));
      }
      const missing = res.fromApi === true && res.status === 404;
      setState((prev) => ({ ...LOADING, status: missing ? "missing" : "failed", error: res.error, run: prev.run }));
    });
    return () => {
      cancelled = true;
    };
  }, [deckId, launch, attempt]);

  const rate = useCallback((card, rating) => {
    ratings.current.push({ card, rating, promise: rateCard(card.id, rating) });
  }, []);

  // Runs once per run: a second tap on the last button gets the first call's answer.
  const finish = useCallback(() => {
    finishing.current ??= (async () => {
      const done = ratings.current;
      const first = await Promise.allSettled(done.map((item) => item.promise));
      const failed = done.filter((_, i) => !saved(first[i]));
      const retried = await Promise.allSettled(failed.map((item) => rateCard(item.card.id, item.rating)));
      return {
        reviewed: done.length,
        got: done.filter((item) => item.rating === "got").length,
        learning: done.filter((item) => item.rating === "learning").length,
        unsaved: retried.filter((outcome) => !saved(outcome)).length,
      };
    })();
    return finishing.current;
  }, []);

  return { ...state, reload: useCallback(() => setAttempt((n) => n + 1), []), rate, finish };
}
