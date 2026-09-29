import axios from "axios";

// Browser side of Web Push: registers the service worker, asks permission, and hands
// the subscription to the server. Which devices belong to which account lives on the
// server; the localStorage flag below only remembers "this person turned it on here",
// so a different account on a shared computer doesn't inherit someone else's setting.

const flagKey = (userId) => `stresscare-push-${userId}`;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

export const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// iPhones only allow web push once the site is added to the Home Screen.
export const needsInstall = () => isIOS() && !isStandalone();

const urlBase64ToUint8Array = (base64) => {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const getRegistration = async () => {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
};

const readFlag = (userId) => {
  try { return localStorage.getItem(flagKey(userId)) === "1"; } catch { return false; }
};
const writeFlag = (userId, on) => {
  try {
    if (on) localStorage.setItem(flagKey(userId), "1");
    else localStorage.removeItem(flagKey(userId));
  } catch { /* storage blocked, the setting just won't survive a restart */ }
};

// "unsupported" | "install" | "denied" | "off" | "on"
export const getPushStatus = async (userId) => {
  if (!pushSupported()) return needsInstall() ? "install" : "unsupported";
  if (needsInstall()) return "install";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted" || !readFlag(userId)) return "off";
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? "on" : "off";
  } catch {
    return "off";
  }
};

export const enablePush = async (backendUrl, userId) => {
  if (!pushSupported()) return { ok: false, reason: needsInstall() ? "install" : "unsupported" };

  const { data: keyData } = await axios.get(`${backendUrl}/api/notifications/push/key`);
  if (!keyData.success || !keyData.enabled) return { ok: false, reason: "server" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: permission === "denied" ? "denied" : "dismissed" };

  const registration = await getRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    }));

  const { data } = await axios.post(`${backendUrl}/api/notifications/push/subscribe`, {
    subscription: subscription.toJSON(),
  });
  if (!data.success) return { ok: false, reason: "server" };

  writeFlag(userId, true);
  return { ok: true };
};

export const disablePush = async (backendUrl, userId) => {
  writeFlag(userId, false);
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await axios.post(`${backendUrl}/api/notifications/push/unsubscribe`, { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  } catch { /* nothing left to clean up */ }
};

// Called after login: if this person already turned alerts on for this browser, make
// sure the server still has the subscription (it may have expired or been replaced).
export const syncPush = async (backendUrl, userId) => {
  if (!pushSupported() || needsInstall() || Notification.permission !== "granted" || !readFlag(userId)) return;
  try {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await axios.post(`${backendUrl}/api/notifications/push/subscribe`, { subscription: subscription.toJSON() });
    } else {
      writeFlag(userId, false);
    }
  } catch { /* try again next visit */ }
};

// Called on logout, before the session cookie goes away: this browser stops receiving
// the account's alerts, but keeps the opt-in flag so logging back in restores them.
export const detachPush = async (backendUrl) => {
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await axios.post(`${backendUrl}/api/notifications/push/unsubscribe`, { endpoint: subscription.endpoint });
    }
  } catch { /* logging out shouldn't fail over this */ }
};
