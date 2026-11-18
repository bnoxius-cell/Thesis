import { meetingProvider } from "@/utils/scheduleUtils";

// The Join button on a class with a meeting link. A real link that opens in a new tab. By default a small
// secondary button (Plan's blocks); a page can ask for another look with `variant`, `size`, `icon`, `label` and
// its own `className` (the Subject page's hero and rows).
export default function JoinLink({ entry, variant = "secondary", size = "sm", icon: Icon, label = "Join", className = "plan-join" }) {
  const provider = meetingProvider(entry.meetingUrl);
  return (
    <a
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${className}`.trim()}
      href={entry.meetingUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Join ${entry.title}${provider?.name ? ` on ${provider.name}` : ""}`}
    >
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span>{label}</span>
    </a>
  );
}
