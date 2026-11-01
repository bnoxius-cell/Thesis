import { MessageCircle, UsersRound } from "lucide-react";
import { EmptyState, Skeleton } from "@/shared/ui";
import GroupList from "./GroupList";
import GroupNotFound from "./GroupNotFound";
import GroupView from "./GroupView";

// The Groups tab on a wide screen (Figma 64:2): the list on the left, the open group on the right.
// The empty page for a student with no groups at all is Pe2's (66:963), so this is a placeholder.
export default function GroupsPane({ data, groupId, tab }) {
  const { groups, status, error, reload } = data;
  const group = groups?.find((g) => g._id === groupId);

  if (status === "ready" && groups.length === 0) {
    return (
      <EmptyState page icon={UsersRound} title="No groups yet">
        Groups you join will show up here.
      </EmptyState>
    );
  }

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
    main = <GroupView key={group._id} group={group} tab={tab} />;
  } else if (status === "ready") {
    main = <GroupNotFound />;
  }

  return (
    <div className="people-panes">
      <GroupList groups={groups} status={status} error={error} onRetry={reload} activeId={groupId} />
      <div className="people-panes__main">{main}</div>
    </div>
  );
}
