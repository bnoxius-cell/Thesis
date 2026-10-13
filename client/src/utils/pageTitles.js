// The tab title for each route. NotificationContext adds the unread count in front of it.
const TITLES = {
  "/": "Sign in",
  "/dashboard": "Today",
  "/schedule": "Schedule",
  "/reviewers": "Study",
  "/groups": "People",
  "/profile": "Me",
  "/wellbeing": "Wellbeing",
  "/notifications": "Notifications",
  "/about": "About",
  "/terms-of-service": "Terms of Service",
  "/privacy-policy": "Privacy Policy",
};

export function pageTitle(pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const root = clean.startsWith("/profile/") ? "/profile" : clean;
  const name = TITLES[root];
  return name ? `${name} | StressCare` : "StressCare";
}
