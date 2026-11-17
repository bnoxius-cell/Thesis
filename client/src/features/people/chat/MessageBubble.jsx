import ShareCard from "./ShareCard";
import { SHARE_CARDS } from "./shareCards";

// One message. A shared task, reviewer or timetable is a card (shareCards.js); a message someone removed
// shows as a quiet note; anything else is a bubble of text.
export default function MessageBubble({ message, mine, sender, plan }) {
  if (message.deleted) {
    return (
      <p className="people-bubble people-bubble--removed">
        {message.deletedByAdmin ? "An admin removed this message." : "This message was removed."}
      </p>
    );
  }
  const card = SHARE_CARDS[message.type];
  if (card && message[card.field]) {
    return <ShareCard message={message} mine={mine} sender={sender} plan={plan} />;
  }
  return (
    <p
      className={`people-bubble ${message.fresh ? "is-entering" : ""}`.trim()}
      data-pending={message.pending || undefined}
    >
      {message.text}
    </p>
  );
}
