import { useMemo } from "react";
import { Lock, Plus } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";
import useNow from "@/shared/hooks/useNow";
import { groupTasks } from "@/features/tasks/groupTasks";
import GroupTaskRow from "./GroupTaskRow";

const countLine = (open, done) => (open + done === 0 ? "Nothing to do yet" : `${open} open, ${done} done`);

// The Group tasks section of the plan (Figma GW-1, GW-4 and the empty frames): its title with the open and
// done counts, an Add task button for admins, a quiet note for members who can only look, then the rows
// (open ones by due date, finished ones after) or an empty card. `editorsOf(task)` gives the names of the
// people editing that task right now.
export default function GroupTaskList({ tasks, canEdit, myId, editorsOf, onAdd, onEdit, onToggle }) {
  const now = useNow();
  const { rows, open, done } = useMemo(() => {
    const { overdue, today, week, later, done: finished } = groupTasks(tasks);
    const unfinished = [...overdue, ...today, ...week, ...later];
    return { rows: [...unfinished, ...finished], open: unfinished.length, done: finished.length };
  }, [tasks]);

  return (
    <section className="group-tasks" aria-labelledby="group-tasks-title">
      <header className="group-section__head">
        <div className="group-section__titles">
          <h3 id="group-tasks-title" className="group-section__title">Group tasks</h3>
          <p className="group-section__sub">{countLine(open, done)}</p>
        </div>
        {canEdit && rows.length > 0 && (
          <Button icon={Plus} className="group-tasks__add" onClick={onAdd}>
            Add task
          </Button>
        )}
      </header>
      {!canEdit && (
        <p className="group-tasks__locked">
          <Lock size={20} aria-hidden="true" />
          Admins edit the group plan. You can see everything here.
        </p>
      )}
      {rows.length > 0 ? (
        <ul className="group-tasks__rows">
          {rows.map((task) => (
            <GroupTaskRow
              key={task._id}
              task={task}
              canEdit={canEdit}
              editors={editorsOf(task)}
              myId={myId}
              now={now}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          titleAs="p"
          className="group-plan__empty"
          title="No group tasks yet"
          actions={canEdit && <Button icon={Plus} onClick={onAdd}>Add the first task</Button>}
        >
          {canEdit ? "Add the first task and everyone in the group will see it." : "An admin can add tasks for the group. They will show up here."}
        </EmptyState>
      )}
    </section>
  );
}
