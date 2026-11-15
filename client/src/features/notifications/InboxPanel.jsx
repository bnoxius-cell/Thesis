import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, TriangleAlert } from "lucide-react";
import { Button, EmptyState, Segment, Skeleton } from "@/shared/ui";
import useNow from "@/shared/hooks/useNow";
import { isGroupItem } from "./notificationKinds";
import { splitByDay } from "./inboxTime";
import NotificationRow from "./NotificationRow";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "groups", label: "Groups" },
];
const KEEP = {
  all: () => true,
  unread: (n) => !n.isRead,
  groups: isGroupItem,
};
const NONE_FOR = { unread: "No unread notifications.", groups: "No group notifications." };

// The inbox body shared by the drawer and the page: filter, the day sections and every state (loading,
// failed, empty, filtered empty), then the link to the settings. Opening a row marks it read and goes
// to where it points (a row with no link only gets marked); `onLeave` then lets the drawer close itself.
// A row can also be deleted on its own (hover X, Delete key or a swipe; see NotificationRow).
// `toolbar` is for the page, where the actions sit above the filter instead of in the drawer's header.
export default function InboxPanel({ inbox, onLeave, toolbar }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const now = useNow();
  const labelId = useId();
  const { status, items } = inbox;

  const open = (notification) => {
    const path = inbox.open(notification);
    if (!path) return;
    navigate(path);
    onLeave?.();
  };
  const shown = items.filter(KEEP[filter]);
  const sections = splitByDay(shown, now);

  let body;
  if (status === "loading") {
    body = <Loading />;
  } else if (status === "failed") {
    body = (
      <div role="alert">
        <EmptyState className="inbox__state" icon={TriangleAlert} titleAs="p" title="Couldn't load your notifications." actions={<Button variant="ghost" size="sm" onClick={() => inbox.reload()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState className="inbox__state" icon={Bell} titleAs="p" title="You're all caught up.">
        New notifications will show up here.
      </EmptyState>
    );
  } else {
    body = (
      <>
        <div className="inbox__filter">
          <Segment label="Show" options={FILTERS} value={filter} onChange={setFilter} />
        </div>
        {sections.length === 0 && <p className="inbox__none">{NONE_FOR[filter]}</p>}
        <div key={filter} className="inbox__sections panel-fade">
          {sections.map((section) => (
            <section key={section.key} aria-labelledby={`${labelId}-${section.key}`}>
              <p id={`${labelId}-${section.key}`} className="inbox__section">{section.label}</p>
              <ul className="inbox__list">
                {section.items.map((n) => (
                  <li key={n._id}>
                    <NotificationRow notification={n} now={now} onOpen={open} onRemove={inbox.remove} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="inbox">
      {toolbar && <div className="inbox__toolbar">{toolbar}</div>}
      <div className="inbox__body">{body}</div>
      <Link to="/settings" className="inbox__settings" onClick={onLeave}>
        Notification settings
      </Link>
    </div>
  );
}

function Loading() {
  return (
    <div role="status" className="inbox__loading">
      <span className="sr-only">Loading notifications</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="inbox__skeleton">
          <Skeleton width="36px" height="36px" circle />
          <div className="inbox__skeleton-lines">
            <Skeleton width="42%" height="12px" />
            <Skeleton width="74%" height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
}
