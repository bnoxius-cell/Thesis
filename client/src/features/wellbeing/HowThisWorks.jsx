import { ChevronDown, Info } from "lucide-react";
import { Card } from "@/shared/ui";
import { PSS_VALID_DAYS, WHO_VALID_DAYS } from "@/utils/workload";

// How this works (Figma 51:2): the method in plain words and where the two check-ins come from. Closed
// until opened. The "Full method on About" link waits for the About page.
export default function HowThisWorks() {
  return (
    <Card as="details" className="wellbeing-how">
      <summary className="wellbeing-how__summary">
        <Info size={20} aria-hidden="true" />
        <span>How this works</span>
        <ChevronDown size={20} className="wellbeing-how__chevron" aria-hidden="true" />
      </summary>
      <div className="wellbeing-how__body">
        <p>
          The load is an estimate the app works out from what it knows about your week: how soon your deadlines
          are and how much work they hold, your busiest day, how full your timetable is, how important and hard
          your tasks are, and your two check-ins. Anything missing, like a check-in you haven't taken, is left
          out and the rest is rescaled, so nothing is guessed.
        </p>
        <p>
          A stress check-in counts for {PSS_VALID_DAYS} days and a well-being check-in for {WHO_VALID_DAYS}.
          After that they stop affecting the estimate until you take them again. If you're stressed, low on
          energy or facing a heavy week, the app speaks up sooner and offers more ideas for moving work.
        </p>
        <p className="wellbeing-how__sources">
          Stress: Perceived Stress Scale (PSS-10), Cohen, Kamarck and Mermelstein, 1983. Well-being: WHO-5
          Well-Being Index, World Health Organization, 1998. Both are widely used questionnaires. The app uses
          them to adjust your plan, not to diagnose anything.
        </p>
      </div>
    </Card>
  );
}
