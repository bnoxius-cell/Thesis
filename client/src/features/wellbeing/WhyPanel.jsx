import { useState } from "react";
import { CalendarClock, CalendarDays, ChevronDown, Lightbulb } from "lucide-react";
import { Button } from "@/shared/ui";
import { ideaTitle } from "@/utils/suggestions";

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
// doing a task earlier (Open task shows it; the deadline never changes). With no reasons, the top tips stand in.
// `reasons` are the words from weekReasons.js, `tips` the workload tips, `moves` from useMoveSuggestions.
export default function WhyPanel({ reasons, tips, moves, now }) {
  const [open, setOpen] = useState(false);
  const idea = moves.visible[0];
  const openTask = idea && moves.openerFor(idea);
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
              key={`${idea.taskId}:${idea.doOn}`}
              icon={CalendarClock}
              title={ideaTitle(idea, now)}
              detail={idea.why}
              actions={(
                <>
                  {openTask && <Button variant="secondary" onClick={openTask}>Open task</Button>}
                  <Button variant="ghost" onClick={() => moves.dismiss(idea)}>Not now</Button>
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
