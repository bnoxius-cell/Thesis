import { Link } from "react-router-dom";
import { CalendarClock, GraduationCap, Brain, HeartPulse, ArrowRight, Info } from "lucide-react";

// A small icon per reason, picked from the words. Unknown reasons (a later planner may add its own)
// fall back to a neutral one.
function reasonIcon(text) {
  const t = text.toLowerCase();
  if (t.includes("deadline")) return CalendarClock;
  if (t.includes("timetable") || t.includes("classes")) return GraduationCap;
  if (t.includes("stress")) return Brain;
  if (t.includes("well-being")) return HeartPulse;
  return Info;
}

// Light and Steady weeks read as good news, Full and Very full as "worth a look". Never red.
const CHIP_TONE = { light: "is-good", steady: "is-good", full: "is-watch", over: "is-watch" };

// The week in words: a chip, one sentence, up to three reasons, one next action and the caption.
// No number: it lives one tap deeper on Wellbeing. `reading` comes from toWeekReading().
export default function WeekCard({ reading }) {
  const [action] = reading.actions;
  const toDetails = action?.to === "/wellbeing";

  return (
    <section className="panel week-card" data-tour="dash-doing" aria-labelledby="week-card-title">
      <div className="week-card-head">
        <h2 id="week-card-title">This week</h2>
        <span className={`chip ${CHIP_TONE[reading.band] || "is-neutral"}`}>{reading.label}</span>
      </div>

      <p className="week-card-headline">{reading.headline}</p>

      {reading.reasons.length > 0 && (
        <ul className="week-card-reasons" aria-label="What shapes your week">
          {reading.reasons.map((reason) => {
            const Icon = reasonIcon(reason);
            return (
              <li key={reason}>
                <Icon size={16} aria-hidden="true" />
                <span>{reason}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="week-card-actions">
        {action && <Link to={action.to} className="tonal-button">{action.label}<ArrowRight size={16} aria-hidden="true" /></Link>}
        {!toDetails && <Link to="/wellbeing" className="ghost-button">See details</Link>}
      </div>

      <p className="week-card-note">{reading.note}</p>
    </section>
  );
}
