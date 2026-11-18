import { useState } from "react";
import { ConfirmDialog } from "@/shared/ui";
import { deleteSubject } from "@/shared/api/subjects";
import FilesChoice from "@/features/files/FilesChoice";
import { filesText } from "@/features/files/fileKinds";

// Confirms deleting a subject (Figma 162:3461, phone sheet 162:3654, with the class times line MS-4 407:2699 and
// 407:2961). The server unlinks its tasks and reviewers (they stay, with their course label) and takes its class
// times off the student's own timetables, which the first line says. A subject with files asks what happens to
// them, "Keep the files" (they move to General) chosen, and the button says when they go too. A failed delete
// keeps the dialog open with the message.
export default function DeleteSubjectDialog({ subject, onClose, onDeleted }) {
  const [choice, setChoice] = useState("keep");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileCount = subject.counts?.files ?? 0;
  const classTimes = subject.counts?.classTimes ?? 0;
  const removing = fileCount > 0 && choice === "delete";

  const confirm = async () => {
    setBusy(true);
    setError("");
    const { error: failure } = await deleteSubject(subject._id, removing ? "delete" : "keep");
    setBusy(false);
    if (failure) setError(failure);
    else onDeleted();
  };

  return (
    <ConfirmDialog
      open
      sheet
      tone="danger"
      title={`Delete "${subject.name}"?`}
      confirmLabel={removing ? `Delete subject and ${filesText(fileCount)}` : "Delete subject"}
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {classTimes > 0 && (
        <span className="study-dialog__lead">
          Its {classTimes} class {classTimes === 1 ? "time leaves" : "times leave"} your timetable.
        </span>
      )}
      {fileCount > 0 ? (
        <FilesChoice
          intro={`This subject has ${filesText(fileCount)}. What should happen to the files?`}
          value={choice}
          onChange={setChoice}
        />
      ) : (
        `Its tasks and reviewers stay in your lists, they just won't belong to a subject any more.${classTimes > 0 ? "" : " Your timetable isn't changed."}`
      )}
      {error && <span className="study-dialog__error" role="alert"> {error}</span>}
    </ConfirmDialog>
  );
}
