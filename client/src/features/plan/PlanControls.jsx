import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, IconButton, Segment } from "@/shared/ui";
import { weekRange, weekTitle } from "./weekLabel";

const VIEWS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "tasks", label: "Tasks" },
];

// The row under the page title (Figma 38:3, 40:387): the view switch and, in Week view, the date
// stepper with a Today button. The Filter button is not built (nothing to filter by yet) and the
// timetable switcher joins this row in P2.
export default function PlanControls({ view, onView, weekStart, now, onShift, onToday }) {
  return (
    <div className="plan-controls">
      <Segment className="plan-views" label="View" options={VIEWS} value={view} onChange={onView} />
      {view === "week" && (
        <div className="plan-step">
          <IconButton className="plan-step__btn" icon={ChevronLeft} label="Previous week" onClick={() => onShift(-1)} />
          <p className="plan-step__range" aria-live="polite">
            <strong>{weekTitle(weekStart, now)}</strong>
            <span>{weekRange(weekStart, now)}</span>
          </p>
          <IconButton className="plan-step__btn" icon={ChevronRight} label="Next week" onClick={() => onShift(1)} />
          <Button variant="secondary" className="plan-step__today" onClick={onToday}>Today</Button>
        </div>
      )}
    </div>
  );
}
