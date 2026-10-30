// The Animations switch (Profile > Look and motion). "on" plays motion even when the device asks for
// less, "off" never plays it, "system" follows prefers-reduced-motion. The choice is kept per browser
// and mirrored on <html data-motion> (index.html sets it before the first paint).
const KEY = "stresscare-motion";
const CHOICES = ["on", "system", "off"];

export function readMotionPref() {
  try {
    const saved = localStorage.getItem(KEY);
    return CHOICES.includes(saved) ? saved : "system";
  } catch {
    return document.documentElement.dataset.motion || "system";
  }
}

export function setMotionPref(value) {
  if (!CHOICES.includes(value)) return;
  document.documentElement.dataset.motion = value;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Private window or blocked storage: the choice still applies for this visit.
  }
}

// True when motion should be skipped. JS asks this instead of matchMedia, so it follows the switch.
export function prefersLessMotion() {
  const pref = readMotionPref();
  if (pref === "off") return true;
  if (pref === "on") return false;
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

// Marks <html> while the tab is hidden so the ambient layer can pause (motion.css).
export function watchVisibility() {
  const mark = () => document.documentElement.classList.toggle("is-hidden", document.hidden);
  document.addEventListener("visibilitychange", mark);
  mark();
}
