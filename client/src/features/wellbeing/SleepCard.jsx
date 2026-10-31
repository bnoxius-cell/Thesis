import { Moon, Sun } from "lucide-react";
import { Card } from "@/shared/ui";

// Sleep (Figma 51:2, 52:117): tonight's bedtime, the window from bed to wake and the hours aimed for.
// `summary` comes from sleepSummary.js. The Sleep plan link isn't built (no page behind it).
export default function SleepCard({ summary }) {
  const { headline, window, target, note } = summary;

  return (
    <Card as="section" id="sleep" className="wellbeing-sleep" aria-labelledby="wellbeing-tonight">
      <span className="wellbeing-chip" aria-hidden="true"><Moon size={18} /></span>
      <div className="wellbeing-sleep__tonight">
        <h2 id="wellbeing-tonight" className="wellbeing-eyebrow">Tonight</h2>
        <p className="wellbeing-sleep__headline">{headline}</p>
        {note && <p className="wellbeing-sleep__note">{note}</p>}
      </div>
      {window && (
        <div className="wellbeing-sleep__window">
          <span className="wellbeing-time"><Moon size={20} aria-hidden="true" />{window.bed}</span>
          <span className="wellbeing-sleep__target">
            <span className="wellbeing-sleep__bar" aria-hidden="true" />
            <span>{target} h target</span>
          </span>
          <span className="wellbeing-time"><Sun size={20} aria-hidden="true" />{window.wake}</span>
        </div>
      )}
    </Card>
  );
}
