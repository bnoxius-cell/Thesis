import { Inbox } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";
import PersonRow from "./PersonRow";

// The Requests view (Figma 115:922): people who asked to be friends. Decline is quiet, Accept is
// the one filled button. Both wait while that request is being answered.
export default function FriendRequests({ requests, busyId, onAccept, onDecline }) {
  if (requests.length === 0) {
    return (
      <div className="people-card people-card--quiet">
        <EmptyState icon={Inbox} title="No requests right now">
          When a classmate adds you, their request shows up here.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="people-card people-card--list">
      <ul className="people-persons stagger">
        {requests.map((request) => {
          const { user } = request;
          const busy = busyId === request._id;
          return (
            <PersonRow
              key={request._id}
              to={`/people/${user._id}`}
              name={user.name}
              picture={user.avatar}
              line={user.profileTag ? `Code ${user.profileTag}` : null}
            >
              <Button variant="ghost" disabled={busy} onClick={() => onDecline(request)} aria-label={`Decline ${user.name}`}>
                Decline
              </Button>
              <Button busy={busy} onClick={() => onAccept(request)} aria-label={`Accept ${user.name}`}>
                Accept
              </Button>
            </PersonRow>
          );
        })}
      </ul>
    </div>
  );
}
