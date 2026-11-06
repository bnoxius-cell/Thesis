import { UsersRound } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";
import "./people-add.css";

// A student with no groups (Figma 66:963). New group and Join a group open the same dialogs as the "+" menu.
export default function GroupsEmpty({ onNewGroup, onJoinGroup }) {
  const actions = (
    <>
      <Button onClick={onNewGroup}>New group</Button>
      <Button variant="secondary" onClick={onJoinGroup}>Join a group</Button>
    </>
  );
  return (
    <div className="people-empty">
      <EmptyState page icon={UsersRound} title="No groups yet" actions={actions}>
        Start a group for your class, or join one with a code from a classmate.
      </EmptyState>
    </div>
  );
}
