import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  HeartPulse,
  House,
  ListChecks,
  Moon,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";

// The sidebar, as drawn in Figma 16:3. An item is lit when its `isActive` says so for the current
// location; the rules read path, query and hash, and no two items can be lit at once (Plan is not
// lit on Tasks, Overview is not lit on Check-ins).
// `badge` names a count from useUnread, `badgeNoun` is what a screen reader hears after it.
// Flashcards is left out until it has a backend.

const under = (pathname, base) => pathname === base || pathname.startsWith(`${base}/`);
const param = ({ search }, key) => new URLSearchParams(search).get(key);

const onPlan = (loc) => under(loc.pathname, "/plan");
const onStudyReviewers = (loc) =>
  under(loc.pathname, "/study/reviewers") || (loc.pathname === "/study" && param(loc, "tab") === "reviewers");
const onWellbeing = (loc) => under(loc.pathname, "/wellbeing");

export const NAV_GROUPS = [
  {
    key: "main",
    items: [
      { key: "home", label: "Home", to: "/home", icon: House, isActive: (loc) => under(loc.pathname, "/home") },
      { key: "plan", label: "Plan", to: "/plan", icon: CalendarDays, isActive: (loc) => onPlan(loc) && param(loc, "view") !== "tasks" },
      { key: "tasks", label: "Tasks", to: "/plan?view=tasks", icon: ListChecks, isActive: (loc) => onPlan(loc) && param(loc, "view") === "tasks" },
    ],
  },
  {
    key: "study",
    label: "Study",
    items: [
      {
        key: "subjects",
        label: "Subjects",
        to: "/study",
        icon: BookOpen,
        isActive: (loc) => under(loc.pathname, "/study") && !onStudyReviewers(loc),
      },
      { key: "reviewers", label: "Reviewers", to: "/study?tab=reviewers", icon: FileText, isActive: onStudyReviewers },
    ],
  },
  {
    key: "wellbeing",
    label: "Wellbeing",
    items: [
      {
        key: "overview",
        label: "Overview",
        to: "/wellbeing",
        icon: HeartPulse,
        isActive: (loc) => onWellbeing(loc) && loc.hash !== "#feeling" && loc.hash !== "#sleep",
      },
      { key: "checkins", label: "Check-ins", to: "/wellbeing#feeling", icon: ClipboardCheck, isActive: (loc) => onWellbeing(loc) && loc.hash === "#feeling" },
      { key: "sleep", label: "Sleep plan", to: "/wellbeing#sleep", icon: Moon, isActive: (loc) => onWellbeing(loc) && loc.hash === "#sleep" },
    ],
  },
  {
    key: "people",
    label: "People",
    items: [
      {
        key: "groups",
        label: "Groups",
        to: "/people",
        icon: Users,
        badge: "groupsUnread",
        badgeNoun: "groups with new messages",
        isActive: (loc) => loc.pathname === "/people" || under(loc.pathname, "/people/groups"),
      },
      {
        key: "friends",
        label: "Friends",
        to: "/people/friends",
        icon: UserPlus,
        badge: "friendRequests",
        badgeNoun: "friend requests",
        isActive: (loc) => loc.pathname === "/people/friends",
      },
    ],
  },
];

// Pinned to the bottom. Log out is not a place, so it lives in Sidebar as a button.
export const SETTINGS_ITEM = {
  key: "settings",
  label: "Settings",
  to: "/me/settings",
  icon: Settings,
  isActive: (loc) => under(loc.pathname, "/me/settings"),
};

export const ALL_ITEMS = [...NAV_GROUPS.flatMap((group) => group.items), SETTINGS_ITEM];
