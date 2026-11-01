import { useState } from "react";
import { Search } from "lucide-react";
import { Button, Skeleton } from "@/shared/ui";
import { useUnread } from "@/app/shell/unreadContext";
import GroupListRow from "./GroupListRow";

function ListSkeleton() {
  return (
    <div className="people-list__loading" role="status" aria-label="Loading your groups">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} height="68px" className="people-list__skeleton" />)}
    </div>
  );
}

// The groups on the left: a search box over the rows. `groups` is null until they have loaded.
export default function GroupList({ groups, status, error, onRetry, activeId }) {
  const { groupUnread } = useUnread();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = (groups ?? []).filter((group) => group.name.toLowerCase().includes(needle));

  return (
    <div className="people-list">
      {status === "loading" && <ListSkeleton />}
      {status === "failed" && (
        <div className="people-list__failed" role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={onRetry}>Try again</Button>
        </div>
      )}
      {groups && (
        <>
          <div className="people-list__search">
            <Search size={20} aria-hidden="true" className="people-list__icon" />
            <input
              type="search"
              className="people-search"
              placeholder="Search groups"
              aria-label="Search groups"
              autoComplete="off"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {shown.length > 0 ? (
            <ul className="people-rows stagger">
              {shown.map((group) => (
                <GroupListRow
                  key={group._id}
                  group={group}
                  active={group._id === activeId}
                  unread={group._id === activeId ? 0 : groupUnread[group._id] ?? 0}
                />
              ))}
            </ul>
          ) : (
            <p className="people-list__none" role="status">No group matches that search.</p>
          )}
        </>
      )}
    </div>
  );
}
