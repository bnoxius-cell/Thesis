import { useEffect } from "react";

// The browser tab title is "<page> · StressCare", with the unread count in front while there is one:
// "(3) Home · StressCare". The page name and the count come from different places (each page, and the
// shell's unread poll), so both are kept here and the title is rebuilt whenever either changes.
let pageTitle = "StressCare";
let unread = 0;

function renderTitle() {
  document.title = unread > 0 ? `(${unread}) ${pageTitle}` : pageTitle;
}

// Shows the unread count in the tab title and, where the browser has the Badging API (an installed
// app), on its icon. Call with 0 to clear both.
export function showUnreadCount(count) {
  unread = count;
  renderTitle();
  const badge = count > 0 ? navigator.setAppBadge?.(count) : navigator.clearAppBadge?.();
  badge?.catch(() => {});
}

// Sets the browser tab title to "<title> · StressCare" while the page is on screen.
export default function usePageTitle(title) {
  useEffect(() => {
    pageTitle = title ? `${title} · StressCare` : "StressCare";
    renderTitle();
  }, [title]);
}
