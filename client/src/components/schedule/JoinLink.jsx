import { Video } from "lucide-react";
import { meetingProvider } from "../../utils/scheduleUtils";

// The Join button for an online class (Google Meet, Zoom, Teams...). A real link that opens in a
// new tab, so it works the same for viewers and editors and can be long-pressed or copied.
export default function JoinLink({ url, className = "sched-join" }) {
  const provider = meetingProvider(url);
  return (
    <a className={className} href={url} target="_blank" rel="noopener noreferrer" title={provider?.name ? `Join on ${provider.name}` : "Join the online class"}>
      <Video size={14} aria-hidden="true" /> Join{provider?.short ? ` ${provider.short}` : ""}
    </a>
  );
}
