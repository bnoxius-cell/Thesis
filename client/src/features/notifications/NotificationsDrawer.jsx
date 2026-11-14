import { useId } from "react";
import { X } from "lucide-react";
import { IconButton, ModalShell } from "@/shared/ui";
import InboxActions from "./InboxActions";
import InboxPanel from "./InboxPanel";
import useInbox from "./useInbox";
import "./notifications.css";

// The inbox as a drawer from the right (Figma 290:17094), opened by the bell from 1024px. It is a
// ModalShell, so the focus trap, Escape, an outside click, the scroll lock and the "What's new" wait
// come with it. Mount it only while it is open: the list loads when it mounts.
export default function NotificationsDrawer({ onClose }) {
  const titleId = useId();
  const inbox = useInbox();

  return (
    <ModalShell drawer onClose={onClose} labelledBy={titleId} className="inbox-drawer">
      <div className="inbox-drawer__head">
        <h2 id={titleId} className="ui-modal__title">
          Notifications
        </h2>
        <InboxActions inbox={inbox} />
        <IconButton plain icon={X} label="Close" onClick={onClose} />
      </div>
      <div className="inbox-drawer__scroll">
        <InboxPanel inbox={inbox} onLeave={onClose} />
      </div>
    </ModalShell>
  );
}
