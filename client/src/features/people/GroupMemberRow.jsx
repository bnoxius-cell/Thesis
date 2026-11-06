import { MoreHorizontal, ShieldCheck, ShieldOff, UserMinus } from "lucide-react";
import { Chip, IconButton, Menu, MenuItem } from "@/shared/ui";
import PeopleAvatar from "./PeopleAvatar";

// One member in the Info dialog (Figma 64:1224): picture, name, and Owner / Admin as a chip (plain
// "Member" text otherwise). `actions` is a list of { key, label, icon, danger, run }, empty for most
// people, which shows no menu at all.
export default function GroupMemberRow({ person, isMe, role, actions }) {
  return (
    <li className="people-info__member">
      <PeopleAvatar name={person.name} src={person.avatar} className="people-info__avatar" />
      <span className="people-info__name">{isMe ? `${person.name} (you)` : person.name}</span>
      {role === "owner" && <Chip tone="accent">Owner</Chip>}
      {role === "admin" && <Chip tone="neutral">Admin</Chip>}
      {role === "member" && <span className="people-info__role">Member</span>}
      {actions.length > 0 && (
        <Menu
          align="end"
          label={`Manage ${person.name}`}
          trigger={(props) => <IconButton plain icon={MoreHorizontal} label={`Manage ${person.name}`} {...props} />}
        >
          {actions.map(({ key, label, icon, danger, run }) => (
            <MenuItem key={key} icon={icon} tone={danger ? "danger" : undefined} onSelect={run}>
              {label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </li>
  );
}

export const MEMBER_ICONS = { promote: ShieldCheck, demote: ShieldOff, remove: UserMinus };
