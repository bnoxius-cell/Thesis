// The tab title for each route. NotificationContext adds the unread count in front of it.
const TITLES = {
  "/": "Sign in",
  "/home": "Today",
  "/plan": "Schedule",
  "/study": "Study",
  "/study/subjects": "Subject",
  "/study/reviewers": "Study",
  "/people": "People",
  "/profile": "Profile",
  "/wellbeing": "Wellbeing",
  "/notifications": "Notifications",
  "/about": "About",
  "/terms-of-service": "Terms of Service",
  "/privacy-policy": "Privacy Policy",
};

export function pageTitle(pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const root = ["/profile", "/people", "/study/subjects", "/study/reviewers"].find((base) => clean.startsWith(`${base}/`)) || clean;
  const name = TITLES[root];
  return name ? `${name} | StressCare` : "StressCare";
}
