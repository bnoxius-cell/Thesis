import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchFlashcards, fetchReview, rateCard } from "@/shared/api/flashcards";

const LOADING = { status: "loading", error: "", cards: [], deck: null, mode: "due", run: 0 };

// A rating that saved: the api answers { data } or { error } and never rejects.
const saved = (outcome) => outcome.status === "fulfilled" && !outcome.value.error;

// The cards of one review run, for one deck id (or every deck when it is empty).
//   status    "loading" | "loaded" | "empty" (nothing to review) | "missing" (no such deck, or not theirs) | "failed"
//   error     a plain message for the missing and failed states
//   cards     [{ id, term, answer }] to study
//   deck      { id, title, course } for a deck run, null across decks
//   mode      "due" (cards that were due) or "all" (a practice run on a deck with nothing due: Got it keeps the schedule)
//   run       counts up with every load, so the study screen can be keyed per run
//   reload    tries again
//   rate      rate(card, "got" | "learning") fires the save and returns at once, so the next card never waits
//   finish    waits for every save, tries the failed ones once more, answers { reviewed, got, learning, unsaved }
//   complete  finish, then one refetch of the decks; `summary` becomes { ...finish's answer, stillDue, scope }
//   summary   null until complete() settles; the end screen shows while it is set. `scope` is the decks the run
//             covered (for the next-due line) and `stillDue` their due count, null when the refetch failed
// Every navigation to the page opens a run once, as the Practice page does.
export default function useFlashcardRun(deckId) {
  const launch = useLocation().key;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState(LOADING);
  const ratings = useRef([]); // { card, rating, promise } for the run on screen
  const finishing = useRef(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...LOADING, run: prev.run }));
    ratings.current = [];
    finishing.current = null;
    setSummary(null);
    fetchReview(deckId).then((res) => {
      if (cancelled) return;
      if (res.data) {
        const { cards, deck, mode } = res.data;
        return setState((prev) => ({ ...LOADING, status: cards.length ? "loaded" : "empty", cards, deck, mode, run: prev.run + 1 }));
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

  // The still-due count comes from the server, capped at one run's size, as Go over again will get it.
  const complete = useCallback(async () => {
    const tally = await finish();
    const res = await fetchFlashcards();
    const scope = res.data ? res.data.decks.filter((deck) => !deckId || deck.id === deckId) : null;
    const due = scope?.reduce((sum, deck) => sum + deck.due, 0) ?? null;
    const batch = res.data?.limits.reviewBatch ?? Infinity;
    setSummary({ ...tally, scope, stillDue: due === null ? null : Math.min(due, batch) });
  }, [finish, deckId]);

  return { ...state, summary, complete, reload: useCallback(() => setAttempt((n) => n + 1), []), rate, finish };
}
