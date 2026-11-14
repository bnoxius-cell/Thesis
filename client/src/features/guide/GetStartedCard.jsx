import { useEffect, useRef, useState } from "react";
import { useGlobalAdd } from "@/app/shell/add/addContext";
import { Button, Card, ProgressBar, showActionToast } from "@/shared/ui";
import { prefersLessMotion } from "@/utils/motion";
import ChecklistRow from "./ChecklistRow";
import { SETUP_STEPS, doneCount } from "./setupSteps";
import useGuide from "./useGuide";
import "./guide.css";

const FADE_MS = 150;

// The Get started card at the top of Home (Figma 317:380, 317:642, 317:901, phone 318:703, 318:811):
// four steps that tick from real data, each with one button that does the step right there. Hide fades
// the card out (opacity only), then hides it with an Undo toast. When all four are done it says
// "You're all set" with a Done button for the rest of the visit. `setup` is useSetupSteps().
export default function GetStartedCard({ setup }) {
  const { steps, finished, dismiss } = setup;
  const { hideSetup, showSetup } = useGuide();
  const { open } = useGlobalAdd();
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Fades the card out, then runs `after` (which unmounts it).
  const leave = (after) => {
    setLeaving(true);
    timer.current = setTimeout(after, prefersLessMotion() ? 0 : FADE_MS);
  };
  const hide = () =>
    leave(() => {
      hideSetup();
      showActionToast("Get started is hidden. You can bring it back from Settings > Help.", { label: "Undo", onAction: showSetup });
    });

  const done = doneCount(steps);
  const progress = `${done} of ${SETUP_STEPS.length} done`;

  return (
    <Card as="section" id="get-started" className="get-started" data-leaving={leaving || undefined} aria-labelledby="get-started-title">
      <header className="get-started__head">
        <div className="get-started__titles">
          <h2 id="get-started-title" className="get-started__title">{finished ? "You're all set. Nice work." : "Get started"}</h2>
          <p className="get-started__count">{progress}</p>
        </div>
        <ProgressBar className="get-started__bar" tone="good" value={done / SETUP_STEPS.length} label="Get started progress" valueText={progress} />
        {finished ? (
          <Button variant="secondary" className="get-started__action" onClick={() => leave(dismiss)}>Done</Button>
        ) : (
          <Button variant="ghost" className="get-started__action" onClick={hide}>Hide</Button>
        )}
      </header>
      <ol className="get-started__rows stagger">
        {SETUP_STEPS.map((step) => (
          <ChecklistRow key={step.key} step={step} done={Boolean(steps[step.key])} onAdd={open} />
        ))}
      </ol>
    </Card>
  );
}
