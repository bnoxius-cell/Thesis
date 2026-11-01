import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import { useUnread } from "@/app/shell/unreadContext";
import { useAuth } from "@/pages/authentication/AuthContext";
import Composer from "./chat/Composer";
import MessageList from "./chat/MessageList";
import GroupHeader from "./GroupHeader";
import GroupNotFound from "./GroupNotFound";
import useGroupChat from "./useGroupChat";
import "./people-group.css";

// One open group: its head, then the chat or the Upcoming tab. The chat keeps polling behind
// Upcoming, so coming back to Chat finds it up to date. Mount it with the group id as its `key`.
// `desktop` picks the wide layout (the name is an h2 under the page's h1) or the phone screen.
export default function GroupView({ group, tab, desktop }) {
  const { userData } = useAuth();
  const { markGroupRead } = useUnread();
  const me = useMemo(
    () => ({ _id: userData?._id, name: userData?.name, avatar: userData?.avatar }),
    [userData?._id, userData?.name, userData?.avatar],
  );
  const chat = useGroupChat(group._id, { me, onRead: markGroupRead });

  if (chat.status === "gone") return <GroupNotFound asPage={!desktop} />;

  return (
    <section className="people-group" aria-label={group.name}>
      <GroupHeader group={group} tab={tab} desktop={desktop} />
      <div
        className="people-group__panel"
        role="tabpanel"
        id="people-group-panel"
        aria-labelledby={`people-group-tab-${tab}`}
      >
        {tab === "upcoming" ? (
          <EmptyState icon={CalendarClock} title="On its way">
            Deadlines your group shares will be listed here soon.
          </EmptyState>
        ) : (
          <>
            <MessageList items={chat.items} myId={userData?._id} status={chat.status} error={chat.error} onRetry={chat.retry} />
            <Composer
              label={`Message ${group.name}`}
              placeholder={desktop ? `Message ${group.name}` : "Message"}
              onSend={chat.send}
            />
          </>
        )}
      </div>
    </section>
  );
}
