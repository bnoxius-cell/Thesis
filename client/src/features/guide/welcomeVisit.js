// True once the welcome tour has opened during this page load, so "What's new" waits for the next
// visit instead of popping up behind it or right after it. A module flag: a reload starts clean.
let shown = false;

export const markWelcomeShown = () => {
  shown = true;
};

export const welcomeShownThisVisit = () => shown;
