// One message. Shared tasks and timetables show as a plain line until their cards are built; a
// message someone removed shows as a quiet note.
function bubbleText(message) {
  if (message.type === "task") return `Shared a task: ${message.task?.title ?? ""}`;
  if (message.type === "schedule") return `Shared a timetable: ${message.schedule?.title ?? ""}`;
  return message.text;
}

export default function MessageBubble({ message }) {
  if (message.deleted) {
    return (
      <p className="people-bubble people-bubble--removed">
        {message.deletedByAdmin ? "An admin removed this message." : "This message was removed."}
      </p>
    );
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
