import { messageKey } from "../chatMessages";
import { clockTime } from "../chatTime";
import PeopleAvatar from "../PeopleAvatar";
import MessageBubble from "./MessageBubble";

// Messages from one person in a row: a name and time line, the bubbles, and (for others) their
// avatar beside the last bubble. Your own messages sit on the right with just the time.
export default function MessageRun({ run, plan }) {
  const { mine, sender, messages } = run;
  const name = sender?.name ?? "Someone";
  const first = messages[0];
  return (
    <div className="people-run" data-mine={mine || undefined}>
      {!mine && <PeopleAvatar name={name} src={sender?.avatar} className="people-run__avatar" />}
      <div className="people-run__col">
        <p className="people-run__meta">
          {!mine && <span className="people-run__name">{name}</span>}
          <time dateTime={first.createdAt}>{clockTime(first.createdAt)}</time>
        </p>
        {messages.map((message) => (
          <MessageBubble key={messageKey(message)} message={message} mine={mine} sender={sender} plan={plan} />
        ))}
      </div>
    </div>
  );
}
