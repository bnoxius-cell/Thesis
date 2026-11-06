import { useState } from "react";
import { Clock, UserCheck, UserMinus, UserPlus } from "lucide-react";
import { Button, Chip } from "@/shared/ui";
import RemoveFriendDialog from "./RemoveFriendDialog";

// The one thing to do about this student, by how they're connected (Figma 66:759 draws Add friend):
//   none      Add friend
//   sent      a "Request sent" chip (the profile has no request id to cancel with; Pending does that)
//   received  Decline and Accept
//   friends   a "Friends" chip and Remove friend, which asks first
// `person` is the profile; the rest comes from useStudentProfile.
export default function ProfileActions({ person, busy, add, accept, decline, remove }) {
  const [removing, setRemoving] = useState(false);

  if (person.relation === "none") {
    return <Button icon={UserPlus} busy={busy} onClick={add}>Add friend</Button>;
  }
  if (person.relation === "sent") {
    return <Chip tone="neutral" icon={Clock}>Request sent</Chip>;
  }
  if (person.relation === "received") {
    return (
      <>
        <Button variant="ghost" disabled={busy} onClick={decline}>Decline</Button>
        <Button busy={busy} onClick={accept}>Accept</Button>
      </>
    );
  }
  if (person.relation === "friends") {
    return (
      <>
        <Chip tone="good" icon={UserCheck}>Friends</Chip>
        <Button variant="secondary" icon={UserMinus} disabled={busy} onClick={() => setRemoving(true)}>
          Remove friend
        </Button>
        <RemoveFriendDialog
          friend={removing ? person : null}
          busy={busy}
          onConfirm={async () => {
            await remove();
            setRemoving(false);
          }}
          onCancel={() => setRemoving(false)}
        />
      </>
    );
  }
  return null;
}
