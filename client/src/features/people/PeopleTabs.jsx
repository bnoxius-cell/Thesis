import { Tabs } from "@/shared/ui";
import { useUnread } from "@/app/shell/unreadContext";

// Groups | Friends (Figma Tab 61:73). Each is a link, so the address says which one is open. The
// counts match the sidebar: groups with news, and friend requests waiting.
export default function PeopleTabs({ tab, block = false }) {
  const { groupsUnread, friendRequests } = useUnread();
  const items = [
    { value: "groups", label: "Groups", count: groupsUnread, to: "/people", id: "people-tab-groups", panelId: "people-panel" },
    { value: "friends", label: "Friends", count: friendRequests, to: "/people/friends", id: "people-tab-friends", panelId: "people-panel" },
  ];
  return <Tabs items={items} value={tab} label="People sections" block={block} className="people-tabs" />;
}
