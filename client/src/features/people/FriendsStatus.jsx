import { Button, Skeleton } from "@/shared/ui";

// What the Friends views show before there is anything to list: rows on their way, or a plain
// message with Try again when the first load failed.
export default function FriendsStatus({ status, error, onRetry }) {
  if (status === "failed") {
    return (
      <div className="people-card people-card--quiet people-failed" role="alert">
        <p>{error}</p>
        <Button variant="secondary" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  return (
    <div className="people-card people-card--list" role="status" aria-label="Loading your friends">
      {[0, 1, 2].map((i) => <Skeleton key={i} height="64px" className="people-person__skeleton" />)}
    </div>
  );
}
