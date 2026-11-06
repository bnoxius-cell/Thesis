import { UsersRound } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import usePageTitle from "@/app/usePageTitle";
import { useFocusView } from "@/app/shell/focusView";
import GroupNotFound from "./GroupNotFound";
import GroupView from "./GroupView";

// A group's chat as a whole phone screen (Figma 67:939): no page header and no bottom bar, so the
// composer sits at the foot of the screen.
export default function PhoneChat({ data, groupId, tab }) {
  const { groups, status, error, reload, refresh } = data;
  const group = groups?.find((g) => g._id === groupId);
  usePageTitle(group?.name ?? "People");
  useFocusView(true);

  let body;
  if (group) {
    body = <GroupView key={group._id} group={group} tab={tab} desktop={false} onChanged={refresh} />;
  } else if (status === "loading") {
    body = (
      <div className="people-chatscreen__loading" role="status" aria-label="Opening the chat">
        <Skeleton height="44px" className="people-chatscreen__skeleton" />
        <Skeleton height="44px" className="people-chatscreen__skeleton" />
      </div>
    );
  } else if (status === "failed") {
    body = (
      <EmptyState
        icon={UsersRound}
        title="Couldn't load your groups"
        titleAs="h1"
        actions={<Button variant="secondary" onClick={reload}>Try again</Button>}
      >
        {error}
      </EmptyState>
    );
  } else {
    body = <GroupNotFound asPage />;
  }

  return <div className="people-chatscreen">{body}</div>;
}
