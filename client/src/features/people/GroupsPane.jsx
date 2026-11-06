import { MessageCircle } from "lucide-react";
import { EmptyState, Skeleton } from "@/shared/ui";
import GroupList from "./GroupList";
import GroupsEmpty from "./GroupsEmpty";
import GroupNotFound from "./GroupNotFound";
import GroupView from "./GroupView";

// The Groups tab. On a wide screen (Figma 64:2) the list is on the left and the open group on the
// right; on a phone (67:818) it is the list alone, and a group opens as its own screen (PhoneChat).
// A student with no groups at all gets the empty page (66:963).
export default function GroupsPane({ data, groupId, tab, desktop }) {
  const { groups, status, error, reload, refresh } = data;
  const group = groups?.find((g) => g._id === groupId);

  if (status === "ready" && groups.length === 0) {
    return <GroupsEmpty />;
  }

  const list = <GroupList groups={groups} status={status} error={error} onRetry={reload} activeId={groupId} />;
  if (!desktop) return list;

  let main;
  if (!groupId) {
    main = (
      <EmptyState icon={MessageCircle} title="Pick a group">
        Its chat opens here.
      </EmptyState>
    );
  } else if (status === "loading") {
    main = <Skeleton height="100%" className="people-panes__skeleton" />;
  } else if (group) {
    main = <GroupView key={group._id} group={group} tab={tab} desktop onChanged={refresh} />;
  } else if (status === "ready") {
    main = <GroupNotFound />;
  }

  return (
    <div className="people-panes">
      {list}
      <div className="people-panes__main">{main}</div>
    </div>
  );
}
