import { useState } from "react";
import { CalendarClock, CalendarDays, ChevronDown, Lightbulb } from "lucide-react";
import { Button } from "@/shared/ui";
import { shortDate } from "@/shared/lib/dates";

const MAX_ROWS = 3;

function ReasonRow({ icon: Icon, title, detail, actions }) {
  return (
    <li className="wellbeing-reason">
      <span className="wellbeing-chip" aria-hidden="true"><Icon size={18} /></span>
      <div className="wellbeing-reason__text">
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </div>
      {actions && <div className="wellbeing-reason__actions">{actions}</div>}
    </li>
  );
}

// "Why" under the load (Figma 53:170): up to three plain reasons for the reading, then the best idea for
// moving a deadline (Move it saves the new date and offers Undo). With no reasons, the top tips stand in.
// `reasons` are the words from weekReasons.js, `tips` the workload tips, `moves` from useMoveSuggestions.
export default function WhyPanel({ reasons, tips, moves }) {
  const [open, setOpen] = useState(false);
  const idea = moves.visible[0];
  const rows = reasons.length
    ? reasons.slice(0, MAX_ROWS).map((text) => ({ key: text, icon: CalendarDays, title: text }))
    : tips.slice(0, MAX_ROWS).map((tip) => ({ key: tip.title, icon: Lightbulb, title: tip.title, detail: tip.text }));

  return (
    <div className="wellbeing-why">
      <button
        type="button"
        className="wellbeing-why__toggle"
        aria-expanded={open}
        aria-controls="wellbeing-why-list"
        onClick={() => setOpen((value) => !value)}
      >
        Why
        <ChevronDown size={20} aria-hidden="true" />
      </button>
      {open && (
        <ul id="wellbeing-why-list" className="wellbeing-why__list stagger">
          {rows.map(({ key, ...row }) => <ReasonRow key={key} {...row} />)}
          {idea && (
            <ReasonRow
              key={`${idea.taskId}:${idea.toDate}`}
              icon={CalendarClock}
              title={`Move "${idea.title}" to ${shortDate(idea.toDate)}`}
              detail={idea.why}
              actions={(
                <>
                  <Button variant="secondary" busy={moves.moving} onClick={() => moves.move(idea)}>Move it</Button>
                  <Button variant="ghost" disabled={moves.moving} onClick={() => moves.dismiss(idea)}>Not now</Button>
                </>
              )}
            />
          )}
          {rows.length === 0 && !idea && <ReasonRow icon={CalendarDays} title="Nothing is piling up right now" />}
        </ul>
      )}
    </div>
  );
}
