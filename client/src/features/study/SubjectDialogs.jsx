import { toast } from "react-toastify";
import DeleteSubjectDialog from "./DeleteSubjectDialog";
import NewSubjectDialog from "./NewSubjectDialog";

// The one open subject dialog, if any. `dialog` is { type: "edit" | "delete", subject }. New subjects come
// from the global add. After a change it refreshes in place, thanks the student and closes.
export default function SubjectDialogs({ dialog, onClose, onChanged }) {
  if (!dialog) return null;
  const done = (message) => {
    toast.success(message);
    onChanged();
    onClose();
  };

  if (dialog.type === "delete") {
    return <DeleteSubjectDialog subject={dialog.subject} onClose={onClose} onDeleted={() => done("Subject deleted.")} />;
  }
  return (
    <NewSubjectDialog
      subject={dialog.subject}
      onClose={onClose}
      onSaved={() => done("Subject saved.")}
    />
  );
}
