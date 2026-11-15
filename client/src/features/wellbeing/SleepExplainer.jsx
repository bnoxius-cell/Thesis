import { useId, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Card } from "@/shared/ui";
import { sleepExplainerPoints } from "./sleepExplainerPoints";

// How the sleep plan works (Figma 332:852): six numbered points under the Tonight card. Closed it is a
// one-line row like How this works; the toggle is a plain disclosure button. The panel eases open on a
// grid-row transition (base.css cuts it short under reduced motion).
export default function SleepExplainer({ summary }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <Card as="section" className="wellbeing-explainer" data-open={open || undefined}>
      <button
        type="button"
        className="wellbeing-explainer__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Info size={20} className="wellbeing-explainer__icon" aria-hidden="true" />
        <span className="wellbeing-explainer__title">How the sleep plan works</span>
        <span className="wellbeing-explainer__action">{open ? "Hide" : "Show"}</span>
        <ChevronDown size={20} className="wellbeing-explainer__chevron" aria-hidden="true" />
      </button>
      <div id={panelId} className="wellbeing-explainer__panel">
        <ol className="wellbeing-explainer__points">
          {sleepExplainerPoints(summary).map(({ label, text }, index) => (
            <li key={label} className="wellbeing-explainer__point">
              <span className="wellbeing-explainer__number">{index + 1}</span>
              <span className="wellbeing-explainer__label">{label}</span>
              <span className="wellbeing-explainer__text">{text}</span>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
