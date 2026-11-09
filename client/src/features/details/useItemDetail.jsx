import { useCallback, useState } from "react";
import TaskDetails from "./TaskDetails";
import EntryDetails from "./EntryDetails";

// A study task the timetable made up ("Prepare for Midterm") is not a stored task, so it has no details.
const isPrepTask = (task) => task.isExam || String(task._id).startsWith("exam:");

// The details window for any task or timetable entry, one per page.
//   const detail = useItemDetail({ subjects, onToggle, context });
//   <ItemOpenButton onClick={() => detail.openTask(task)}>, then render {detail.dialog} once.
// `subjects` are the student's own. `onToggle(task, done)` ticks a task off or back on. `context` says where
// the window is open, so it can leave out a link to the page it's on: "home", "plan-week", "plan-tasks" or
// "subject:<id>". `onEditTask`, `onDeleteTask`, `onEditEntry` and `onDeleteEntry` are optional; each one is
// called with the item and `{ close }`, and without it the window draws no such button.
// openEntry(entry, iso) takes the entry as it is on day `iso` (YYYY-MM-DD).
export default function useItemDetail({
  subjects,
  onToggle,
  context,
  onEditTask,
  onDeleteTask,
  onEditEntry,
  onDeleteEntry,
}) {
  const [item, setItem] = useState(null);
  const close = useCallback(() => setItem(null), []);
  const openTask = useCallback((task) => {
    if (!isPrepTask(task)) setItem({ task });
  }, []);
  const openEntry = useCallback((entry, iso) => setItem({ entry, iso }), []);

  let dialog = null;
  if (item?.task) {
    dialog = (
      <TaskDetails
        task={item.task}
        subjects={subjects}
        context={context}
        onClose={close}
        onToggle={onToggle}
        onEdit={onEditTask}
        onDelete={onDeleteTask}
      />
    );
  } else if (item?.entry) {
    dialog = (
      <EntryDetails
        entry={item.entry}
        iso={item.iso}
        subjects={subjects}
        context={context}
        onClose={close}
        onEdit={onEditEntry}
        onDelete={onDeleteEntry}
      />
    );
  }

  return { openTask, openEntry, dialog };
}
