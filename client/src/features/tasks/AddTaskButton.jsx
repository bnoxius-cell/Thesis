import { useState } from "react";
import { toast } from "react-toastify";
import { AddButton } from "@/shared/ui";
import NewTaskDialog from "./NewTaskDialog";

// The "+" next to the Home and Plan titles. Opens New task; `onAdded` gets the saved task so the page
// can put it in its list without a reload. A class has no dialog drawn yet, so there is no menu.
export default function AddTaskButton({ subjects, onAdded }) {
  const [open, setOpen] = useState(false);

  const saved = (task) => {
    setOpen(false);
    onAdded(task);
    toast.success("Task added.");
  };

  return (
    <>
      <AddButton label="Add a task" onClick={() => setOpen(true)} />
      {open && <NewTaskDialog subjects={subjects} onClose={() => setOpen(false)} onSaved={saved} />}
    </>
  );
}
