import { useState } from "react";
import { toast } from "react-toastify";
import { showActionToast } from "@/shared/ui";
import { archiveSubject, restoreSubject } from "@/shared/api/subjects";
import RestoreSubjectDialog from "./RestoreSubjectDialog";
import { restoreText } from "./termText";

// Archiving one subject and bringing one back, for a page that lists subjects.
//   const subjectArchive = useSubjectArchive({ onChanged });
//   subjectArchive.archive(subject)      archives at once and offers Undo in the toast
//   subjectArchive.askRestore(subject)   opens the confirm; render {subjectArchive.dialog} once
// `onChanged` runs after either, so the page can read its lists again.
export default function useSubjectArchive({ onChanged }) {
  const [restoring, setRestoring] = useState(null);

  const restored = (subject, result) => {
    setRestoring(null);
    toast.success(restoreText(subject.name, result));
    onChanged();
  };

  const undo = async (subject) => {
    const { data, error } = await restoreSubject(subject._id);
    if (error) toast.error(error);
    else restored(subject, data);
  };

  const archive = async (subject) => {
    const { error } = await archiveSubject(subject._id);
    if (error) return toast.error(error);
    onChanged();
    showActionToast(`Archived ${subject.name}.`, { label: "Undo", onAction: () => undo(subject) });
  };

  const dialog = restoring && (
    <RestoreSubjectDialog subject={restoring} onClose={() => setRestoring(null)} onRestored={(result) => restored(restoring, result)} />
  );
  return { archive, askRestore: setRestoring, dialog };
}
