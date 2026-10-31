import { useLocation } from "react-router-dom";
import { CalendarClock, ClipboardCheck, Lightbulb, Moon } from "lucide-react";
import { Button, Card } from "@/shared/ui";
import { shortDate } from "@/shared/lib/dates";
import { nextStepFor } from "./nextStep";

const CHECKIN_NAME = { pss: "stress", who: "well-being" };
const ICON = { checkin: ClipboardCheck, sleep: Moon, move: CalendarClock, tip: Lightbulb, empty: Lightbulb };

// What to say for each kind of next step: a title, a line under it, and the buttons.
function useContent(step, { moves, onLater, isNewUser }) {
  const { pathname, search, hash } = useLocation();

  switch (step.kind) {
    case "checkin": {
      const { kind, canLater } = step.prompt;
      return {
        title: `Time for your ${CHECKIN_NAME[kind]} check-in`,
        detail: "It takes about 2 minutes and helps your plan fit you. It isn't a test.",
        actions: (
          <>
            <Button to={`/wellbeing/check-in/${kind}`} state={{ from: pathname + search + hash }}>Check in</Button>
            {canLater && <Button variant="ghost" onClick={onLater}>Later</Button>}
          </>
        ),
      };
    }
    case "sleep":
      return { title: "Aim for an earlier night", detail: step.sleep.text };
    case "move": {
      const { idea } = step;
      return {
        title: `Move "${idea.title}" to ${shortDate(idea.toDate)}`,
        detail: idea.why,
        actions: (
          <>
            <Button busy={moves.moving} onClick={() => moves.move(idea)}>Move it</Button>
            <Button variant="ghost" disabled={moves.moving} onClick={() => moves.dismiss(idea)}>Not now</Button>
          </>
        ),
      };
    }
    case "tip":
      return { title: step.tip.title, detail: step.tip.text };
    default:
      return {
        title: "Nothing to change",
        detail: isNewUser
          ? "Add your classes or a task, and ideas for your week show up here."
          : "Your plan looks steady right now.",
      };
  }
}

// Next step (Figma 16:109): one suggestion, never a list.
export default function NextStepCard({ prompt, onLater, moves, work, now }) {
  const step = nextStepFor({ prompt, work, moves, now });
  const content = useContent(step, { moves, onLater, isNewUser: work.insights.isNewUser });
  const Icon = ICON[step.kind];

  return (
    <Card as="section" className="home-next" aria-labelledby="home-next">
      <header className="home-card__head">
        <span className="home-chip home-chip--good" aria-hidden="true"><Icon size={18} /></span>
        <h2 id="home-next" className="home-card__title">Next step</h2>
      </header>
      <p className="home-next__title">{content.title}</p>
      <p className="home-next__detail">{content.detail}</p>
      {content.actions && <div className="home-next__actions">{content.actions}</div>}
    </Card>
  );
}
