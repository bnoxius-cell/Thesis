import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, IconButton, Segment } from "@/shared/ui";
import { monthOfWeek } from "@/utils/scheduleUtils";
import { weekRange, weekTitle } from "./weekLabel";

const VIEWS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "tasks", label: "Tasks" },
];

const MONTH_FORMAT = { month: "long", year: "numeric" };

// The row under the page title (Figma 38:3, 38:234, 40:387): the view switch and, in Week and Month
// view, the date stepper with a Today button. Week steps by week and shows "This week, Oct 27 - Nov 2";
// Month steps by month and shows "October 2026". `onShift(-1 | 1)` steps by that view's unit. The Filter button is not built (nothing to filter by yet). `children`
// is the slot at the end of the row, where Week view puts the timetable switcher.
export default function PlanControls({ view, onView, weekStart, now, onShift, onToday, children }) {
  return (
    <div className="plan-controls">
      <Segment className="plan-views" label="View" options={VIEWS} value={view} onChange={onView} />
      {view !== "tasks" && (
        <div className="plan-step">
          <IconButton className="plan-step__btn" icon={ChevronLeft} label={`Previous ${view}`} onClick={() => onShift(-1)} />
          <p className="plan-step__range" aria-live="polite">
            {view === "week" ? (
              <>
                <strong>{weekTitle(weekStart, now)}</strong>
                <span>{weekRange(weekStart, now)}</span>
              </>
            ) : (
              <strong>{monthOfWeek(weekStart).toLocaleDateString("en-US", MONTH_FORMAT)}</strong>
            )}
          </p>
          <IconButton className="plan-step__btn" icon={ChevronRight} label={`Next ${view}`} onClick={() => onShift(1)} />
          <Button variant="secondary" className="plan-step__today" onClick={onToday}>Today</Button>
        </div>
      )}
      {children}
    </div>
  );
}
