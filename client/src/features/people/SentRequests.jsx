import { Send } from "lucide-react";
import { Button, Chip, EmptyState } from "@/shared/ui";
import PersonRow from "./PersonRow";

// The Pending view (Figma 115:1091): requests the student sent that nobody has answered yet.
export default function SentRequests({ requests, busyId, onCancel }) {
  if (requests.length === 0) {
    return (
      <div className="people-card people-card--quiet">
        <EmptyState icon={Send} title="Nothing pending">
          Requests you send wait here until the other person answers.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="people-card people-card--list">
      <ul className="people-persons stagger">
        {requests.map((request) => {
          const { friend } = request;
          return (
            <PersonRow
              key={request._id}
              to={`/people/${friend._id}`}
              name={friend.name}
              picture={friend.avatar}
              line={friend.profileTag ? `Code ${friend.profileTag}` : null}
            >
              <Chip tone="neutral">Pending</Chip>
              <Button
                variant="ghost"
                disabled={busyId === request._id}
                onClick={() => onCancel(request)}
                aria-label={`Cancel request to ${friend.name}`}
              >
                Cancel
              </Button>
            </PersonRow>
          );
        })}
      </ul>
    </div>
  );
}
