import { UsersRound } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";

// A group id that isn't one of the student's groups, or a group they've left or been removed from.
// `asPage` makes the title the screen's h1 (the phone chat has no page header).
export default function GroupNotFound({ asPage = false }) {
  return (
    <EmptyState
      icon={UsersRound}
      title="Group not found"
      titleAs={asPage ? "h1" : "h2"}
      actions={<Button variant="secondary" to="/people">Back to groups</Button>}
    >
      It may have been deleted, or you're no longer a member.
    </EmptyState>
  );
}
