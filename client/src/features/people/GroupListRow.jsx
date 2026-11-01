import { Link } from "react-router-dom";
import { Badge } from "@/shared/ui";
import PeopleAvatar from "./PeopleAvatar";

// One group in the list. The line under the name is the member count: the groups answer carries no
// last message. `unread` is the number of new messages (0 for the open group).
export default function GroupListRow({ group, active, unread }) {
  const count = group.members.length;
  return (
    <li>
      <Link to={`/people/groups/${group._id}`} className="people-row" aria-current={active ? "page" : undefined}>
        <PeopleAvatar name={group.name} src={group.icon} className="people-row__avatar" />
        <span className="people-row__text">
          <span className="people-row__name">{group.name}</span>
          <span className="people-row__line">
            <span className="people-row__meta">{count} {count === 1 ? "member" : "members"}</span>
            <Badge count={unread} />
          </span>
        </span>
        {unread > 0 && <span className="sr-only">, {unread} unread</span>}
      </Link>
    </li>
  );
}
