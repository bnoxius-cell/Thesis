import { useState } from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, UserMinus, UserPlus, UserRound } from "lucide-react";
import { Button, EmptyState, IconButton, Menu, MenuItem } from "@/shared/ui";
import PersonRow from "./PersonRow";
import RemoveFriendDialog from "./RemoveFriendDialog";

const codeLine = (person) => (person.profileTag ? `Code ${person.profileTag}` : null);

// The Friends view (Figma 66:452 desktop, 67:1017 phone): the first few friends, then "Show all N
// friends". Each row opens the friend's profile; its More menu has View profile and Remove friend
// (which asks first). With no friends it is the empty page (66:1130), whose button focuses the code
// field. The friends answer carries no program or shared groups, so the line under a name is the
// friend code.
export default function FriendList({ friends, limit, busyId, onRemove, onAdd }) {
  const [showAll, setShowAll] = useState(false);
  const [removing, setRemoving] = useState(null);

  if (friends.length === 0) {
    return (
      <div className="people-card people-empty people-empty--friends">
        <EmptyState
          page
          icon={UserPlus}
          title="No friends yet"
          actions={<Button onClick={onAdd}>Add a friend</Button>}
        >
          Share your code or add a classmate with theirs. Friends show up here.
        </EmptyState>
      </div>
    );
  }

  const shown = showAll ? friends : friends.slice(0, limit);
  const confirmRemove = async () => {
    await onRemove(removing);
    setRemoving(null);
  };

  return (
    <div className="people-card people-card--list">
      <ul className="people-persons stagger">
        {shown.map((friend) => (
          <PersonRow key={friend._id} to={`/people/${friend._id}`} name={friend.name} picture={friend.avatar} line={codeLine(friend)}>
            <Menu
              align="end"
              label={`Options for ${friend.name}`}
              trigger={(props) => <IconButton label={`More options for ${friend.name}`} icon={MoreHorizontal} {...props} />}
            >
              <MenuItem icon={UserRound} to={`/people/${friend._id}`}>View profile</MenuItem>
              <MenuItem icon={UserMinus} tone="danger" onSelect={() => setRemoving(friend)}>Remove friend</MenuItem>
            </Menu>
          </PersonRow>
        ))}
      </ul>
      {friends.length > limit && (
        <button type="button" className="people-more" aria-expanded={showAll} onClick={() => setShowAll((open) => !open)}>
          {showAll ? "Show fewer" : `Show all ${friends.length} friends`}
          {showAll ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
        </button>
      )}
      <RemoveFriendDialog
        friend={removing}
        busy={removing !== null && busyId === removing._id}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
