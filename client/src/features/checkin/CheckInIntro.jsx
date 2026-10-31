import { useEffect, useRef } from "react";
import { CalendarClock, Info } from "lucide-react";
import { Button, Card } from "@/shared/ui";
import CheckInFact from "./CheckInFact";

// The first screen (Figma 54:536): what the check-in is, why it helps and where it comes from.
export default function CheckInIntro({ questionnaire, onStart, onExit }) {
  const { icon: Icon, name, intro } = questionnaire;
  const startButton = useRef(null);

  // Coming back from the first question lands on Start, not on nothing.
  useEffect(() => startButton.current?.focus({ preventScroll: true }), []);

  return (
    <div className="checkin-column checkin-column--enter">
      <span className="checkin-icon" aria-hidden="true"><Icon size={28} /></span>
      <header className="checkin-heading">
        <p className="checkin-eyebrow">{name} check-in</p>
        <h1 className="checkin-title">{intro.title}</h1>
        <p className="checkin-lead">{intro.lead}</p>
      </header>
      <Card className="checkin-card">
        <CheckInFact icon={Info} title="What it measures">{intro.measures}</CheckInFact>
        <CheckInFact icon={CalendarClock} title="Why it matters">
          Your answers adjust your plan, sleep suggestion and tips.
        </CheckInFact>
      </Card>
      <div className="checkin-notes">
        <p>{intro.citation}</p>
        <p>This is not a diagnosis. It helps your plan fit you.</p>
      </div>
      <div className="checkin-actions">
        <Button ref={startButton} onClick={onStart}>Start</Button>
        <Button variant="ghost" onClick={onExit}>Not now</Button>
      </div>
    </div>
  );
}
