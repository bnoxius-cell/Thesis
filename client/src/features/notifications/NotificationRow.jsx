import { Avatar, Badge } from "@/shared/ui";
import { inboxTime } from "./inboxTime";
import { kindOf, showsPerson } from "./notificationKinds";

// One notification: who or what it is from, the title, up to two lines of message, the time and an
// unread dot. The whole row is one button; the parent decides what opening it does.
export default function NotificationRow({ notification, now, onOpen }) {
  const { icon: Icon, label } = kindOf(notification);
  const unread = !notification.isRead;

  return (
    <button type="button" className="inbox-row" data-unread={unread || undefined} onClick={() => onOpen(notification)}>
      {showsPerson(notification) ? (
        <Avatar name={notification.sender.name} src={notification.sender.avatar} size="md" />
      ) : (
        <span className="inbox-row__chip" aria-hidden="true">
          <Icon size={18} />
        </span>
      )}
      <span className="inbox-row__text">
        <span className="inbox-row__title">{notification.title || label}</span>
        <span className="inbox-row__message">{notification.message}</span>
      </span>
      <span className="inbox-row__meta">
        <time dateTime={new Date(notification.activityAt).toISOString()}>{inboxTime(notification.activityAt, now)}</time>
        {unread && (
          <>
            <Badge dot />
            <span className="sr-only">Unread</span>
          </>
        )}
      </span>
    </button>
  );
}
