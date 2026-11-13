import { CalendarPlus } from "lucide-react";
import { Button } from "@/shared/ui";

// An empty My week (Figma D6: desktop card 212:3651, phone 212:3931): the student has no timetable and
// nothing planned. The day headers stay above it; the card sends them to their first class or a task.
export default function PlanEmpty({ onAddClass, onAddTask }) {
  return (
    <section className="plan-empty" aria-labelledby="plan-empty-title">
      <span className="plan-empty__icon"><CalendarPlus size={28} aria-hidden="true" /></span>
      <div className="plan-empty__text">
        <h2 id="plan-empty-title" className="plan-empty__title">Your week is empty</h2>
        <p>Add your classes once and they repeat every week. Exams, events and tasks fill in around them.</p>
      </div>
      <div className="plan-empty__actions">
        <Button onClick={onAddClass}>Add your first class</Button>
        <Button variant="secondary" onClick={onAddTask}>Add a task</Button>
      </div>
      <p className="plan-empty__hint">Got a timetable in a group chat? Open it there and tap Add to my plan.</p>
    </section>
  );
}
