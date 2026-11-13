import { toast } from "react-toastify";
import TaskFormDialog from "@/features/tasks/TaskFormDialog";
import { KIND_LABELS } from "@/utils/scheduleUtils";
import EntryFormDialog from "./EntryFormDialog";

// The dialog the Plan "+" menu or the empty week chose: New task or New class, exam, event or activity.
// `adding` is "task", an entry kind, or null (nothing open). `timetable` is the picked timetable the
// student can edit, or null for My week. The page refreshes through `onTaskAdded(task)` and `onEntryAdded()`
// (R10); the toast is here so every way in says the same thing.
export default function PlanAdd({ adding, subjects, timetable, onClose, onTaskAdded, onEntryAdded }) {
  if (!adding) return null;
  if (adding === "task") {
    return (
      <TaskFormDialog
        subjects={subjects}
        onClose={onClose}
        onSaved={(task) => {
          onClose();
          onTaskAdded(task);
          toast.success("Task added.");
        }}
      />
    );
  }
  return (
    <EntryFormDialog
      kind={adding}
      subjects={subjects}
      timetable={timetable}
      onClose={onClose}
      onSaved={(schedule, kind) => {
        onClose();
        onEntryAdded();
        toast.success(`${KIND_LABELS[kind]} added.`);
      }}
    />
  );
}
