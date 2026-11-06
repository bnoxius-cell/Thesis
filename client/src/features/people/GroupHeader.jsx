import { createElement } from "react";
import { ArrowLeft } from "lucide-react";
import { Button, IconButton, Tabs } from "@/shared/ui";
import PeopleAvatar from "./PeopleAvatar";

const memberLabel = (count) => `${count} ${count === 1 ? "member" : "members"}`;

// The open group's head: its icon, name and member count, and the Chat | Upcoming tabs (the
// address says which: ?tab=upcoming). On a wide screen the name is an h2 under the page's h1; on a
// phone this is the whole screen's top bar, so the name is the h1 and a back arrow leads to the list.
export default function GroupHeader({ group, tab, desktop, onInfo }) {
  const base = `/people/groups/${group._id}`;
  const tabs = [
    { value: "chat", label: "Chat", to: base, id: "people-group-tab-chat", panelId: "people-group-panel" },
    { value: "upcoming", label: "Upcoming", to: `${base}?tab=upcoming`, id: "people-group-tab-upcoming", panelId: "people-group-panel" },
  ];
  return (
    <header className="people-head">
      {!desktop && <IconButton to="/people" icon={ArrowLeft} label="Back to groups" />}
      <PeopleAvatar name={group.name} src={group.icon} className="people-head__avatar" />
      <div className="people-head__id">
        {createElement(desktop ? "h2" : "h1", { className: "people-head__name" }, group.name)}
        <p className="people-head__meta">{memberLabel(group.members.length)}</p>
      </div>
      <Tabs items={tabs} value={tab} label="Group sections" block={!desktop} className="people-head__tabs" />
      <Button variant="secondary" className="people-head__info" onClick={onInfo}>
        Info
      </Button>
    </header>
  );
}
