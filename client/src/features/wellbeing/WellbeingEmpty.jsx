import { Button } from "@/shared/ui";
import { useGlobalAdd } from "@/app/shell/add/addContext";

// The hero's body for a new account (Figma 53:459): one line, the two ways to fill the week, and seven
// empty bar stubs where the week will draw. Both buttons open the global Add dialogs.
export default function WellbeingEmpty() {
  const { open } = useGlobalAdd();
  return (
    <div className="wellbeing-empty">
      <div className="wellbeing-empty__copy">
        <p className="wellbeing-hero__title">Add classes or tasks to see your week</p>
        <div className="wellbeing-empty__actions">
          <Button onClick={() => open("class")}>Add your classes</Button>
          <Button variant="secondary" onClick={() => open("task")}>Add a task</Button>
        </div>
      </div>
      <div className="wellbeing-empty__stubs" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => <span key={i} />)}
      </div>
    </div>
  );
}
