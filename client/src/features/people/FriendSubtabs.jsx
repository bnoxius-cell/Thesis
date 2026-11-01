import { Link } from "react-router-dom";
import { selectOnArrowKey } from "@/shared/ui/rovingKeys";
import { FRIEND_VIEWS } from "./friendViews";

const TABS = [
  { value: "friends", label: "Friends", to: "/people/friends" },
  { value: "requests", label: "Requests", to: "/people/friends?view=requests" },
  { value: "pending", label: "Pending", to: "/people/friends?view=pending" },
];

// Friends | Requests | Pending (Figma Subtab 115:14): an underline row, each tab with a count pill
// (hidden at 0). Every tab is a link, so the address says which view is open and back, forward and
// shared links work. A waiting request lights its pill even while another view is open.
export default function FriendSubtabs({ view, counts }) {
  const selected = Math.max(FRIEND_VIEWS.indexOf(view), 0);
  return (
    <div
      role="tablist"
      aria-label="Friends views"
      className="people-subtabs"
      onKeyDown={(e) => selectOnArrowKey(e, '[role="tab"]')}
    >
      {TABS.map((tab, i) => {
        const count = counts[tab.value];
        const active = i === selected;
        const alert = tab.value === "requests" && !active && count > 0;
        return (
          <Link
            key={tab.value}
            to={tab.to}
            role="tab"
            id={`people-subtab-${tab.value}`}
            aria-selected={active}
            aria-controls="people-friends-panel"
            tabIndex={active ? 0 : -1}
            className="people-subtab"
          >
            {tab.label}
            {count > 0 && (
              <>
                <span className={`people-subtab__count${alert ? " people-subtab__count--alert" : ""}`} aria-hidden="true">
                  {count}
                </span>
                <span className="sr-only">, {count}</span>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}
