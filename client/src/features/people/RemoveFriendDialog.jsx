import { ConfirmDialog } from "@/shared/ui";

// Asks before ending a friendship. `friend` is the person ({ name }) or null while closed.
export default function RemoveFriendDialog({ friend, busy, onConfirm, onCancel }) {
  return (
    <ConfirmDialog
      open={Boolean(friend)}
      title="Remove this friend?"
      confirmLabel="Remove friend"
      tone="danger"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>You and <strong>{friend?.name}</strong> will no longer be friends. You can send a new request later.</p>
    </ConfirmDialog>
  );
}
