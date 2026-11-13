import { useState } from "react";
import { BookOpen, ClipboardCheck, Flag, ListChecks, Shapes } from "lucide-react";
import { AddButton, Button, Menu, MenuItem, Modal } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import "./add-menu.css";

const OPTIONS = [
  { kind: "task", title: "Task", hint: "Something to finish by a date", icon: ListChecks },
  { kind: "class", title: "Class", hint: "Repeats on the days you pick", icon: BookOpen },
  { kind: "exam", title: "Exam", hint: "One date, with study time before it", icon: ClipboardCheck },
  { kind: "event", title: "Event", hint: "One day, or every week", icon: Flag },
  { kind: "activity", title: "Activity", hint: "Org, sports or work you do each week", icon: Shapes },
];

// The "+" next to the Plan title (Figma D6: popover 212:3296, phone sheet 212:3771). A popover under the
// button from 720px, a bottom sheet "Add to your plan" below. `onPick` gets "task", "class", "exam", "event"
// or "activity". `withTask` is false on a picked timetable, where tasks don't belong.
export default function AddToPlanMenu({ onPick, withTask = true }) {
  const [sheet, setSheet] = useState(false);
  const phone = useMediaQuery("(max-width: 719.98px)");
  const options = withTask ? OPTIONS : OPTIONS.slice(1);

  const choice = (option, extra) => (
    <>
      <span className="add-menu__tile"><option.icon size={20} aria-hidden="true" /></span>
      <span className={`add-menu__text ${extra ?? ""}`.trim()}>
        <span className="add-menu__title">{option.title}</span>
        <span className="add-menu__hint">{option.hint}</span>
      </span>
    </>
  );

  if (phone) {
    const pick = (kind) => {
      setSheet(false);
      onPick(kind);
    };
    return (
      <>
        <AddButton label="Add to your plan" onClick={() => setSheet(true)} />
        {sheet && (
          <Modal
            sheet
            title="Add to your plan"
            className="add-sheet"
            onClose={() => setSheet(false)}
            actions={(close) => <Button variant="ghost" onClick={close}>Cancel</Button>}
          >
            <div className="add-sheet__rows">
              {options.map((option) => (
                <button key={option.kind} type="button" className="add-sheet__row" onClick={() => pick(option.kind)}>
                  {choice(option)}
                </button>
              ))}
            </div>
          </Modal>
        )}
      </>
    );
  }

  return (
    <Menu
      align="end"
      label="Add to your plan"
      menuClassName="add-menu"
      trigger={(props) => <AddButton label="Add to your plan" {...props} />}
    >
      <p className="add-menu__eyebrow">Add to your plan</p>
      {options.map((option) => (
        <MenuItem key={option.kind} className="add-menu__item" onSelect={() => onPick(option.kind)}>
          {choice(option)}
        </MenuItem>
      ))}
    </Menu>
  );
}
