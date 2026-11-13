import { Eye } from "lucide-react";
import { Modal } from "@/shared/ui";
import "./item-detail.css";

// The one details window for a task or a timetable entry (Figma D1, D2), on Modal and a bottom sheet on
// phones. `onBack` (when it was opened from the day window) draws the back arrow and keeps the scrim still
// while the two windows swap. `footer` is a DetailFooter or null; `returnFocusRef` and `initialFocusRef` steer focus (see ModalShell); `children` are the status chip and the DetailRows.
export default function ItemDetailDialog({ title, subtitle, onClose, onBack, footer, returnFocusRef, initialFocusRef, children }) {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      onBack={onBack}
      backLabel="Back to day"
      overlayClassName={onBack ? "item-detail-swap" : undefined}
      sheet
      className="item-detail"
      actions={footer}
      returnFocusRef={returnFocusRef}
      initialFocusRef={initialFocusRef}
    >
      {children}
    </Modal>
  );
}

// The buttons under the details, in the same order everywhere (plan 25 R3): Delete at the left, then Edit,
// then the go-to button. Each one is passed in only when the student may use it, so a missing one just
// isn't drawn. `note` is the muted line that takes the place of Edit and Delete on a read-only item.
// On a phone the go-to button goes on top at full width, with Delete and Edit as two halves under it.
export function DetailFooter({ note, remove, edit, primary }) {
  if (!note && !remove && !edit && !primary) return null;
  return (
    <div className="item-footer">
      {note && (
        <p className="item-footer__note">
          <Eye size={16} aria-hidden="true" />
          {note}
        </p>
      )}
      {remove}
      {edit}
      {primary}
    </div>
  );
}
