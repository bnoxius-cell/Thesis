import { Tabs } from "@/shared/ui";
import PeopleAvatar from "./PeopleAvatar";

const memberLabel = (count) => `${count} ${count === 1 ? "member" : "members"}`;

// The open group's head: its icon, name and member count, and the Chat | Upcoming tabs (the
// address says which: ?tab=upcoming). The name is an h2: the page already has its h1.
export default function GroupHeader({ group, tab }) {
  const base = `/people/groups/${group._id}`;
  const tabs = [
    { value: "chat", label: "Chat", to: base, id: "people-group-tab-chat", panelId: "people-group-panel" },
    { value: "upcoming", label: "Upcoming", to: `${base}?tab=upcoming`, id: "people-group-tab-upcoming", panelId: "people-group-panel" },
  ];
  return (
    <header className="people-head">
      <PeopleAvatar name={group.name} src={group.icon} className="people-head__avatar" />
      <div className="people-head__id">
        <h2 className="people-head__name">{group.name}</h2>
        <p className="people-head__meta">{memberLabel(group.members.length)}</p>
      </div>
      <Tabs items={tabs} value={tab} label="Group sections" className="people-head__tabs" />
    </header>
  );
}
