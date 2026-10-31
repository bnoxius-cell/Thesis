import { ChevronDown } from "lucide-react";
import { Chip, Menu, MenuItem } from "@/shared/ui";
import "./timetable-switcher.css";

// What the chip beside a timetable's name says, if anything (Figma 38:318: Main, Shared).
function chipFor(timetable) {
  if (timetable.role !== "owner") return { tone: "neutral", text: "Shared" };
  if (timetable.isMain) return { tone: "accent", text: "Main" };
  if (!timetable.countInWorkload) return { tone: "neutral", text: "Not in My week" };
  return null;
}

const dotTone = (timetable) => (timetable.role !== "owner" ? "good" : timetable.isMain ? "accent" : "watch");

function TimetableRow({ timetable, selected, onPick }) {
  const chip = chipFor(timetable);
  return (
    <MenuItem className="plan-tt__row" selected={selected} onSelect={() => onPick(timetable._id)}>
      <span className="plan-tt__line">
        <span className={`plan-tt__dot plan-tt__dot--${dotTone(timetable)}`} aria-hidden="true" />
        <span className="plan-tt__name">{timetable.title}</span>
        {chip && <Chip tone={chip.tone}>{chip.text}</Chip>}
      </span>
    </MenuItem>
  );
}

// The "My week" picker in the controls row (Figma 38:318): My week, then the main timetable, the
// student's extras and the ones shared with them, with a check on the one shown. Choosing a row
// calls `onPick` with a timetable id, or null for My week. `timetableId` is the one shown (null for
// My week); an id the list doesn't know yet (a shared link) shows as "Timetable" until it loads.
// "Manage timetables" is not built: its dialogs are not drawn.
export default function TimetableSwitcher({ timetableId, timetables, status, onReload, onPick }) {
  const shown = timetables.find((t) => t._id === timetableId);
  const label = !timetableId ? "My week" : shown?.title ?? "Timetable";

  return (
    <Menu
      role="listbox"
      align="end"
      label="Timetable"
      className="plan-tt"
      trigger={(menu) => (
        <button type="button" className="ui-select plan-tt__trigger" {...menu}>
          <span className="ui-select__value">{label}</span>
          <ChevronDown size={16} className="ui-select__chevron" aria-hidden="true" />
        </button>
      )}
    >
      <MenuItem className="plan-tt__row" selected={!timetableId} onSelect={() => onPick(null)}>
        <span className="plan-tt__text">
          <span className="plan-tt__title">My week</span>
          <span className="plan-tt__hint">Everything that counts for you</span>
        </span>
      </MenuItem>
      {timetables.length > 0 && <span className="plan-tt__eyebrow" aria-hidden="true">Timetables</span>}
      {timetables.map((timetable) => (
        <TimetableRow key={timetable._id} timetable={timetable} selected={timetable._id === timetableId} onPick={onPick} />
      ))}
      {status === "failed" && (
        <MenuItem className="plan-tt__row plan-tt__retry" onSelect={onReload}>
          Couldn't load your timetables. Try again
        </MenuItem>
      )}
    </Menu>
  );
}
