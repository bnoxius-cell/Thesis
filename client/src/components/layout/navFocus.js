// Every page renders its own AppShell, so a navigation unmounts the link that was just activated and
// keyboard focus drops to <body>. This puts it back on <main> once the new page has mounted (the usual
// single-page-app route announcement), but only when the navigation came from a link inside the shell
// (sidebar, top bar, bottom bar, footer). A first load, or a page that moved focus itself, is left alone.

const SHELL_LINKS = '.sidepanel, .topbar, .bottombar, .more-sheet, .app-footer, .site-footer';
const WINDOW_MS = 5000; // long enough for a lazy page chunk on a slow connection

let armedAt = 0;
let installed = false;

// The sidebar is a new element on every page; remember how far it was scrolled.
export const sidebarScroll = { top: 0 };

function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  // Any other key press or pointer press means the student moved on: forget the pending navigation.
  // (A link activation fires keydown or pointerdown first and its click after, which re-arms it.)
  const disarm = () => { armedAt = 0; };
  document.addEventListener('keydown', disarm, true);
  document.addEventListener('pointerdown', disarm, true);
  document.addEventListener(
    'click',
    (e) => {
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (link && link.closest(SHELL_LINKS) && !link.target && !e.defaultPrevented) armedAt = Date.now();
    },
    true,
  );
}

// Called when a shell mounts. Moves focus to <main> if a shell link started this navigation, nothing
// else has focus, and no dialog is open. Stays armed until the window ends, because the first shell
// to mount can be the loading skeleton and the page itself follows.
export function focusMainAfterNavigation(main) {
  install();
  if (!main || !armedAt || Date.now() - armedAt > WINDOW_MS) return;
  const active = document.activeElement;
  if (active && active !== document.body && active !== document.documentElement) return; // the page focused something itself
  if (document.querySelector('[role="dialog"]:not(.tour-panel), .modal-overlay')) return;
  main.focus({ preventScroll: true });
}

// Starts listening as soon as the shell code loads, so the very first link click is seen.
install();
