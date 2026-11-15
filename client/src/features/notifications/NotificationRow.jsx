import { Trash2, X } from "lucide-react";
import { Avatar, Badge } from "@/shared/ui";
import { inboxTime } from "./inboxTime";
import { kindOf, showsPerson } from "./notificationKinds";
import useSwipeToDelete from "./useSwipeToDelete";

// One notification: who or what it is from, the title, up to two lines of message, the time and an
// unread dot. The row itself is one button; the parent decides what opening it does.
// Deleting (Figma 324:2596), no confirm and no undo: a mouse shows an X over the time while the row is
// hovered or keyboard-focused, Delete or Backspace on a focused row does the same, and on a phone a
// swipe left reveals a red Delete (useSwipeToDelete). The X stays focusable while hidden, so it is
// also the way in for screen readers and keyboards on any device.
export default function NotificationRow({ notification, now, onOpen, onRemove }) {
  const { icon: Icon, label } = kindOf(notification);
  const unread = !notification.isRead;
  const { itemRef, slideRef, leaving, leave, handlers } = useSwipeToDelete({ onDelete: () => onRemove(notification) });

  // Gone from under the focus: hand it to the next row (or the one above) so the keyboard keeps its place.
  const remove = () => {
    const item = itemRef.current;
    if (item?.contains(document.activeElement)) {
      const li = item.closest("li");
      (li?.nextElementSibling ?? li?.previousElementSibling)?.querySelector(".inbox-row")?.focus();
    }
    onRemove(notification);
  };

  const onKeyDown = (e) => {
    if ((e.key !== "Delete" && e.key !== "Backspace") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    remove();
  };

  return (
    <div ref={itemRef} className="inbox-item" data-leaving={leaving || undefined}>
      <div className="inbox-item__clip">
        <button type="button" className="inbox-item__action" onClick={leave}>
          <span className="inbox-item__action-face">
            <Trash2 size={20} aria-hidden="true" />
            Delete
          </span>
        </button>
        <div ref={slideRef} className="inbox-item__slide" onKeyDown={onKeyDown} {...handlers}>
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
          <button type="button" className="inbox-row__delete" aria-label="Delete notification" onClick={remove}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
