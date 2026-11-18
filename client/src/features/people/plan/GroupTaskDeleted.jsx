import { Info } from "lucide-react";
import { Button, Modal } from "@/shared/ui";

// What a task's dialog turns into when the server says someone deleted the task while it was open (Figma
// GW-3 "deleted", phone sheet 374:1755). The student's changes are gone, but they see what they had and may
// add it again as a new task. `summary` is the title and the meta line of what they had.
export default function GroupTaskDeleted({ summary, busy, error, onAddAgain, onBack }) {
  return (
    <Modal
      sheet
      className="group-task-dialog"
      title="This task was deleted"
      subtitle="Someone removed it while you had it open."
      busy={busy}
      onClose={onBack}
      actions={
        <>
          <Button variant="secondary" onClick={onAddAgain} busy={busy}>
            Add it again
          </Button>
          <Button onClick={onBack} disabled={busy}>
            Back to the plan
          </Button>
        </>
      }
    >
      <p className="group-task-dialog__note" role="alert">
        <Info size={20} aria-hidden="true" />
        <span>Someone deleted &ldquo;{summary.title}&rdquo;. Your changes were not saved.</span>
      </p>
      <div className="group-task-dialog__ghost">
        <p className="group-task-dialog__ghost-title">{summary.title}</p>
        <p className="group-task-dialog__ghost-meta">{summary.meta}</p>
      </div>
      {error && <p className="group-task-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
