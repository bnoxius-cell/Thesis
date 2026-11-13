import { useCallback, useRef, useState } from "react";
import TaskDetails from "./TaskDetails";
import EntryDetails from "./EntryDetails";

// Only a task saved in the database (a 24-character id) can be edited or deleted.
const isStoredTask = (task) => /^[a-f\d]{24}$/i.test(String(task._id));

// A study task the timetable made up ("Prepare for Midterm") is not a stored task, so it has no details.
const isPrepTask = (task) => task.isExam || String(task._id).startsWith("exam:");

// The details window for any task or timetable entry, one per page.
//   const detail = useItemDetail({ subjects, onToggle, context });
//   <ItemOpenButton onClick={() => detail.openTask(task)}>, then render {detail.dialog} once.
// `subjects` are the student's own. `onToggle(task, done)` ticks a task off or back on. `context` says where
// the window is open, so it can leave out a link to the page it's on: "home", "plan-week", "plan-tasks" or
// "subject:<id>". Closing the window puts focus back on the row that opened it, even after an Edit or Delete
// dialog came and went. `onEditTask`, `onDeleteTask`, `onEditEntry` and `onDeleteEntry` are optional; each one is
// called with the item and `{ close, reopen }` (close this window; reopen it on an item, focus on
// its "edit" or "delete" button), and without it the
// window draws no such button. Edit and Delete are drawn only for a task with a real id.
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
  const row = useRef(null); // the element that opened the window, where focus goes back on close
  const openTask = useCallback((task) => {
    if (isPrepTask(task)) return;
    row.current = document.activeElement;
    setItem({ task });
  }, []);
  const openEntry = useCallback((entry, iso) => {
    row.current = document.activeElement;
    setItem({ entry, iso });
  }, []);
  const reopenTask = useCallback((task, focus) => setItem({ task, focus }), []);

  const replacing = (handler) => handler && ((target, { close: closeWindow }) => handler(target, { close: closeWindow, reopen: reopenTask }));
  const canChange = item?.task && isStoredTask(item.task);

  let dialog = null;
  if (item?.task) {
    dialog = (
      <TaskDetails
        task={item.task}
        subjects={subjects}
        context={context}
        onClose={close}
        returnFocusRef={row}
        focus={item.focus}
        onToggle={onToggle}
        onEdit={canChange ? replacing(onEditTask) : undefined}
        onDelete={canChange ? replacing(onDeleteTask) : undefined}
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
        returnFocusRef={row}
        onEdit={onEditEntry}
        onDelete={onDeleteEntry}
      />
    );
  }

  return { openTask, openEntry, dialog };
}
