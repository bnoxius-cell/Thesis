import SharedTimetableCard from "./SharedTimetableCard";

// One message. A shared timetable is a card; a shared task shows as a plain line (no frame draws a
// task card); a message someone removed shows as a quiet note.
function bubbleText(message) {
  if (message.type === "task") return `Shared a task: ${message.task?.title ?? ""}`;
  return message.text;
}

export default function MessageBubble({ message, mine, sender, plan }) {
  if (message.deleted) {
    return (
      <p className="people-bubble people-bubble--removed">
        {message.deletedByAdmin ? "An admin removed this message." : "This message was removed."}
      </p>
    );
  }
  if (message.type === "schedule" && message.schedule) {
    return <SharedTimetableCard message={message} mine={mine} sender={sender} plan={plan} />;
  }
  return (
    <p
      className={`people-bubble ${message.fresh ? "is-entering" : ""}`.trim()}
      data-pending={message.pending || undefined}
    >
      {bubbleText(message)}
    </p>
  );
}
