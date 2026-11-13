import { useCallback, useRef, useState } from "react";
import useNow from "@/shared/hooks/useNow";
import TaskDetails from "./TaskDetails";
import EntryDetails from "./EntryDetails";
import DayWindow from "./DayWindow";

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
// openDay(day, { onOpenWeek }) opens the day window (Figma D9) on a day from buildDay (features/plan/planDays.js).
// A row in it opens that item's window in its place, with a back arrow to the day; Escape and the X close both.
// The day's "Open this week" calls `onOpenWeek` when given; else, outside Plan's week view (`context` is not
// "plan-week"), it is a link into Plan. Edit and Delete leave the day behind, as they close the window.
export default function useItemDetail({
  subjects,
  onToggle,
  context,
  onEditTask,
  onDeleteTask,
  onEditEntry,
  onDeleteEntry,
}) {
  const now = useNow();
  const [item, setItem] = useState(null);
  // The open day, if any: { day, onOpenWeek, returned }. `returned` is true once an item went back to it.
  const [day, setDay] = useState(null);
  const close = useCallback(() => {
    setItem(null);
    setDay(null);
  }, []);
  const backToDay = useCallback(() => {
    setItem(null);
    setDay((prev) => ({ ...prev, returned: true }));
  }, []);
  const row = useRef(null); // the element that opened the window, where focus goes back on close
  const openDay = useCallback((openedDay, { onOpenWeek } = {}) => {
    row.current = document.activeElement;
    setDay({ day: openedDay, onOpenWeek, returned: false });
  }, []);
  // The day window's rows swap in an item without touching `row`, which stays on what opened the day.
  const showTask = useCallback((task) => {
    if (!isPrepTask(task)) setItem({ task });
  }, []);
  const showEntry = useCallback((entry, iso) => setItem({ entry, iso }), []);
  const openTask = useCallback((task) => {
    row.current = document.activeElement;
    showTask(task);
  }, [showTask]);
  const openEntry = useCallback((entry, iso) => {
    row.current = document.activeElement;
    showEntry(entry, iso);
  }, [showEntry]);
  const reopenTask = useCallback((task, focus) => {
    setDay(null);
    setItem({ task, focus });
  }, []);

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
        onBack={day ? backToDay : undefined}
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
        onBack={day ? backToDay : undefined}
        returnFocusRef={row}
        onEdit={onEditEntry}
        onDelete={onDeleteEntry}
      />
    );
  } else if (day) {
    dialog = (
      <DayWindow
        day={day.day}
        now={now}
        subjects={subjects}
        onClose={close}
        onOpenWeek={day.onOpenWeek}
        weekLink={context !== "plan-week"}
        still={day.returned}
        returnFocusRef={row}
        onOpenEntry={showEntry}
        onOpenTask={showTask}
      />
    );
  }

  return { openTask, openEntry, openDay, dialog };
}
