import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button, Skeleton } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import GroupUpcoming from "../GroupUpcoming";
import GroupTaskDialog from "./GroupTaskDialog";
import GroupTaskList from "./GroupTaskList";
import GroupTimetableCard from "./GroupTimetableCard";
import HereNow from "./HereNow";
import useGroupPlan from "./useGroupPlan";
import "./group-plan.css";

// A group's Plan tab (Figma GW-1 to GW-4): who is here now, the group's tasks, its timetable, and the
// deadlines shared in chat. Admins (the plan's `editor` role) add, change, tick off and delete tasks; other members see all of
// it and change none of it. It stays live while open: other people's changes arrive within a few seconds,
// and the others see who is editing which task. Mount it with the group id as its `key`.
export default function GroupPlan({ group }) {
  const { userData } = useAuth();
  const [dialog, setDialog] = useState(null); // { task } where task is undefined for a new one
  const { plan, status, error, presence, reload, applyTask, dropTask, applyTimetable, setDone } = useGroupPlan(group._id, {
    editingId: dialog?.task?._id ?? null,
  });

  const members = useMemo(() => new Map(group.members.map((member) => [member._id, member])), [group.members]);
  const here = useMemo(
    () => presence.flatMap(({ userId, editing }) => (members.has(userId) ? [{ ...members.get(userId), editing }] : [])),
    [presence, members],
  );
  const editorsOf = (task) => here.filter((person) => person.editing === task._id);

  const closeDialog = () => setDialog(null);
  const saved = (task) => {
    applyTask(task);
    closeDialog();
  };
  const deleted = (taskId) => {
    dropTask(taskId);
    closeDialog();
    toast.success("Task deleted.");
  };

  let body;
  if (status === "loading") {
    body = (
      <div className="group-plan__loading" role="status" aria-label="Loading the plan">
        {[0, 1, 2].map((i) => <Skeleton key={i} height="64px" className="group-plan__skeleton" />)}
      </div>
    );
  } else if (status === "failed") {
    body = (
      <div className="group-plan__failed" role="alert">
        <p>{error}</p>
        <Button variant="secondary" onClick={reload}>Try again</Button>
      </div>
    );
  } else {
    const canEdit = plan.role === "editor";
    body = (
      <>
        <HereNow people={here} />
        <GroupTaskList
          tasks={plan.tasks}
          canEdit={canEdit}
          myId={userData?._id}
          editorsOf={editorsOf}
          onAdd={() => setDialog({})}
          onEdit={(task) => setDialog({ task })}
          onToggle={setDone}
        />
        <GroupTimetableCard
          groupId={group._id}
          timetable={plan.timetable}
          canEdit={canEdit}
          onChanged={applyTimetable}
          onReload={reload}
        />
        <GroupUpcoming groupId={group._id} />
      </>
    );
  }

  return (
    <div className="group-plan">
      {body}
      {dialog && (
        <GroupTaskDialog
          key={dialog.task?._id ?? "new"}
          groupId={group._id}
          groupName={group.name}
          task={dialog.task}
          others={dialog.task ? editorsOf(dialog.task) : []}
          onClose={closeDialog}
          onSaved={saved}
          onDeleted={deleted}
          onGone={dropTask}
        />
      )}
    </div>
  );
}
