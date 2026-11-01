import { UsersRound } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";
import "./people-add.css";

// A student with no groups (Figma 66:963). Its two buttons open dialogs of their own, so each shows
// only once its handler is passed.
export default function GroupsEmpty({ onNewGroup, onJoinGroup }) {
  const actions = (onNewGroup || onJoinGroup) && (
    <>
      {onNewGroup && <Button onClick={onNewGroup}>New group</Button>}
      {onJoinGroup && <Button variant="secondary" onClick={onJoinGroup}>Join a group</Button>}
    </>
  );
  return (
    <div className="people-empty">
      <EmptyState page icon={UsersRound} title="No groups yet" actions={actions || undefined}>
        Start a group for your class, or join one with a code from a classmate.
      </EmptyState>
    </div>
  );
}
