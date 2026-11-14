import { useEffect, useState } from "react";
import { fetchFlashcards } from "@/shared/api/flashcards";
import { fetchFriends } from "@/shared/api/friends";
import { fetchGroups } from "@/shared/api/groups";
import { fetchReviewers } from "@/shared/api/reviewers";

// What the Profile page counts, loaded once from the lists the rest of the app already uses. Each
// value is null until its own request answers (and stays null if it fails), so one slow or broken
// list never hides the others.
//   friends, reviewers, flashcards   numbers (flashcards = cards across all decks)
//   groups                           the student's groups, newest data from the server
export default function useProfileStats() {
  const [stats, setStats] = useState({ friends: null, groups: null, reviewers: null, flashcards: null });

  useEffect(() => {
    let live = true;
    const load = async (key, request, pick) => {
      const { data } = await request();
      if (live && data) setStats((prev) => ({ ...prev, [key]: pick(data) }));
    };
    load("friends", fetchFriends, (data) => (data.friends ?? []).length);
    load("groups", fetchGroups, (data) => data.groups ?? []);
    load("reviewers", fetchReviewers, (data) => (data.reviewers ?? []).length);
    load("flashcards", fetchFlashcards, (data) => (data.decks ?? []).reduce((sum, deck) => sum + (deck.cards ?? 0), 0));
    return () => { live = false; };
  }, []);

  return stats;
}
