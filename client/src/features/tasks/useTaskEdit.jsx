import { useState } from "react";
import { toast } from "react-toastify";
import TaskFormDialog from "./TaskFormDialog";
import DeleteTaskDialog from "./DeleteTaskDialog";

// Edit and delete for a page's task list, wired to the details window (plan 25 C3, R4, R5, R10).
//   const edit = useTaskEdit({ subjects, setTasks });
//   useItemDetail({ ..., onEditTask: edit.onEditTask, onDeleteTask: edit.onDeleteTask }), then {edit.dialog}.
// Edit and Delete replace the details window. Cancel puts the window back; a save puts it back showing the
// saved task; a delete drops the task from the list and shows the toast. `reopen` comes from useItemDetail.
export default function useTaskEdit({ subjects, setTasks }) {
  const [open, setOpen] = useState(null); // { mode: "edit" | "delete", task, reopen }

  const start = (mode) => (task, { close, reopen }) => {
    close();
    setOpen({ mode, task, reopen });
  };
  const onEditTask = start("edit");
  const onDeleteTask = start("delete");

  const back = (task) => {
    setOpen(null);
    open.reopen(task);
  };

  const saved = (task) => {
    if (task !== open.task) setTasks((list) => list.map((item) => (item._id === task._id ? task : item)));
    back(task);
  };

  const deleted = () => {
    setTasks((list) => list.filter((item) => item._id !== open.task._id));
    setOpen(null);
    toast.success("Task deleted.");
  };

  let dialog = null;
  if (open?.mode === "edit") {
    dialog = <TaskFormDialog subjects={subjects} task={open.task} onClose={() => back(open.task)} onSaved={saved} />;
  } else if (open?.mode === "delete") {
    dialog = <DeleteTaskDialog task={open.task} onClose={() => back(open.task)} onDeleted={deleted} />;
  }

  return { onEditTask, onDeleteTask, dialog };
}
