import { ArrowRight, CircleCheck } from "lucide-react";
import { Button } from "@/shared/ui";
import { newTermText } from "./termText";

// The end (TR-4 "done"): what changed, then Back to Study or Open Plan, which lands on the week the classes start
// when a first day was set. `go` closes the wizard and moves on. The heading takes focus, as each step's does.
export default function DoneStep({ result, timetable, firstDay, titleId, headerRef, go }) {
  const { headline, skipped } = newTermText(result, timetable);
  return (
    <div className="term-done tab-panel-in">
      <span className="term-done__tile"><CircleCheck size={20} aria-hidden="true" /></span>
      <div ref={headerRef} tabIndex={-1} className="term-done__text">
        <h2 id={titleId} className="term-done__title">Your new term is ready</h2>
        <p className="term-done__line">{headline}</p>
        {skipped && <p className="term-done__skipped">{skipped}</p>}
      </div>
      <div className="term-actions term-actions--center">
        <Button variant="secondary" onClick={() => go("/study")}>Back to Study</Button>
        <Button icon={ArrowRight} onClick={() => go(firstDay ? `/plan?week=${firstDay}` : "/plan")}>Open Plan</Button>
      </div>
    </div>
  );
}
