import { useEffect, useRef } from "react";
import { BarChart3, CalendarClock, HeartPulse, Moon } from "lucide-react";
import { Button, Card, Skeleton } from "@/shared/ui";
import CheckInFact from "./CheckInFact";
import { resultWords } from "./resultWords";
import useCheckInResult from "./useCheckInResult";

// The last screen (Figma 54:619): what the score says in words, then what it changes. The score is
// already saved; the lines under it appear once the week has loaded. Nothing here moves, since it is a
// result.
export default function CheckInResult({ questionnaire, score }) {
  const { kind, name, period, max } = questionnaire;
  const { status, changes } = useCheckInResult(kind, score);
  const heading = useRef(null);

  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  return (
    <div className="checkin-column">
      <span className="checkin-icon" aria-hidden="true"><HeartPulse size={28} /></span>
      <header className="checkin-heading">
        <p className="checkin-eyebrow">{name} result</p>
        <h1 ref={heading} tabIndex={-1} className="checkin-title">{resultWords(kind, score)} {period}</h1>
        <p className="checkin-lead">
          Score {score} of {max}. It's a snapshot of how {period} felt, not a diagnosis.
        </p>
      </header>

      {status === "loading" && (
        <div role="status" aria-label="Working out what this changes">
          <Skeleton className="checkin-skeleton" height="232px" />
        </div>
      )}
      {status === "failed" && (
        <p className="checkin-quiet" role="status">
          Your result is saved. We couldn't read your week just now, so open Wellbeing to see the changes.
        </p>
      )}
      {changes && (
        <>
          <Card as="section" className="checkin-card" aria-labelledby="checkin-changes">
            <h2 id="checkin-changes" className="checkin-card__title">What this changes</h2>
            <CheckInFact icon={CalendarClock} title="Your plan">{changes.plan}</CheckInFact>
            <CheckInFact icon={Moon} title="Your sleep">{changes.sleep}</CheckInFact>
            <CheckInFact icon={BarChart3} title="Your tips">{changes.tip}</CheckInFact>
          </Card>
          <p className="checkin-encouragement">{changes.encouragement}</p>
        </>
      )}

      <div className="checkin-actions">
        <Button to="/wellbeing" replace>Back to Wellbeing</Button>
        <Button to="/plan" variant="secondary" replace>See my plan</Button>
      </div>
    </div>
  );
}
