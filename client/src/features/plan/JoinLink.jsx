import { meetingProvider } from "@/utils/scheduleUtils";

// The Join button on a class with a meeting link. A real link that opens in a new tab.
export default function JoinLink({ entry }) {
  const provider = meetingProvider(entry.meetingUrl);
  return (
    <a
      className="ui-btn ui-btn--secondary ui-btn--sm plan-join"
      href={entry.meetingUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Join ${entry.title}${provider?.name ? ` on ${provider.name}` : ""}`}
    >
      <span>Join</span>
    </a>
  );
}
