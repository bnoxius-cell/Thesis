import { useCallback, useEffect, useMemo } from "react";
import axios from "axios";
import { useAuth } from "@/pages/authentication/AuthContext";
import { RELEASE_NOTES } from "./releaseNotes";
import { unseenNotes } from "./unseenNotes";

const cacheKey = (userId) => `stresscare-notes-seen:${userId}`;

function readCache(userId) {
  try {
    return localStorage.getItem(cacheKey(userId)) || "";
  } catch {
    return "";
  }
}

function writeCache(userId, id) {
  try {
    localStorage.setItem(cacheKey(userId), id);
  } catch {
    // Storage can be blocked. The account value still counts.
  }
}

// The release notes this student hasn't seen. The account's seenNotesVersion decides; this browser's
// cache only covers a save that is still in flight or failed, so the window can't pop twice.
// New accounts are marked seen silently (no window). markSeen never shows an error: it's a courtesy.
export default function useWhatsNew() {
  const { backendUrl, userData, setUserData } = useAuth();
  const userId = userData?._id;
  const newestId = RELEASE_NOTES[0]?.id ?? "";

  const markSeen = useCallback(() => {
    if (!userId || !newestId) return;
    writeCache(userId, newestId);
    setUserData((prev) => (prev ? { ...prev, seenNotesVersion: newestId } : prev));
    axios.post(`${backendUrl}/api/user/notes-seen`, { version: newestId }).catch(() => {});
  }, [backendUrl, userId, newestId, setUserData]);

  const { entries, silent } = useMemo(() => {
    if (!userData) return { entries: [], silent: false };
    const seenId = readCache(userId) === newestId ? newestId : userData.seenNotesVersion;
    return unseenNotes(RELEASE_NOTES, seenId, userData.createdAt);
  }, [userData, userId, newestId]);

  useEffect(() => {
    if (silent) markSeen();
  }, [silent, markSeen]);

  return { unseen: entries, hasUnseen: entries.length > 0, newestId, markSeen };
}
