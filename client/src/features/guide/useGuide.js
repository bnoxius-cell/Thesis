import { useCallback, useMemo } from "react";
import { useAuth } from "@/pages/authentication/AuthContext";
import { saveGuide } from "@/shared/api/user";

const cacheKey = (userId) => `stresscare-guide:${userId}`;

function readWelcomeCache(userId) {
  try {
    return localStorage.getItem(cacheKey(userId)) === "welcome";
  } catch {
    return false;
  }
}

function writeWelcomeCache(userId) {
  try {
    localStorage.setItem(cacheKey(userId), "welcome");
  } catch {
    // Storage can be blocked. The account value still counts.
  }
}

// The student's guide flags (the welcome tour and the Get started card) from /api/user/data, with the
// actions that change them. Each action updates userData at once, then saves in the background and
// ignores a failure: guidance is a courtesy, never an error. This browser's cache only covers a failed
// welcome save, so the tour can't open twice. `ready` is false while the account has no `guide` yet
// (an API that hasn't deployed): the guide stays out of the way.
export default function useGuide() {
  const { userData, setUserData } = useAuth();
  const userId = userData?._id;
  const serverGuide = userData?.guide;

  const change = useCallback((action, patch) => {
    setUserData((prev) => (prev?.guide ? { ...prev, guide: { ...prev.guide, ...patch } } : prev));
    saveGuide(action);
  }, [setUserData]);

  const markWelcomeDone = useCallback(() => {
    if (userId) writeWelcomeCache(userId);
    change("welcome-done", { welcomeDone: true });
  }, [userId, change]);
  const hideSetup = useCallback(() => change("setup-hide", { setupHidden: true }), [change]);
  const showSetup = useCallback(() => change("setup-show", { setupHidden: false }), [change]);
  // The server records "all done" itself when it first sees all four steps, so this only updates the
  // local copy (the card is dismissed or Home is left), with no save.
  const markSetupDone = useCallback(() => {
    setUserData((prev) => (prev?.guide ? { ...prev, guide: { ...prev.guide, setupDone: true } } : prev));
  }, [setUserData]);

  const guide = useMemo(
    () => serverGuide && { ...serverGuide, welcomeDone: serverGuide.welcomeDone || readWelcomeCache(userId) },
    [serverGuide, userId],
  );

  return { guide, ready: Boolean(guide), markWelcomeDone, hideSetup, showSetup, markSetupDone };
}
