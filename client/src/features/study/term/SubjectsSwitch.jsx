import { CalendarPlus } from "lucide-react";
import { Button, Tabs } from "@/shared/ui";

// The row under Study's tabs (TR-1): Active | Archived, with the archived count, and Start a new term. The
// panel the tabs control is the one StudyPage draws, named `study-view-panel`.
export default function SubjectsSwitch({ view, onView, archivedCount, onStartTerm }) {
  const items = [
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived", count: archivedCount },
  ].map((item) => ({ ...item, id: `study-view-${item.value}`, panelId: "study-view-panel" }));
  return (
    <div className="term-switch">
      <Tabs items={items} value={view} onChange={onView} label="Subjects shown" />
      <Button variant="secondary" icon={CalendarPlus} className="term-switch__start" onClick={onStartTerm}>Start a new term</Button>
    </div>
  );
}
