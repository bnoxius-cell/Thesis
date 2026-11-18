import { Archive, CalendarPlus, Check } from "lucide-react";
import { Button, Chip } from "@/shared/ui";
import { plural } from "@/shared/lib/plural";
import { fromISODate } from "@/utils/scheduleUtils";
import { classTimeCount, filledSubjects, scheduleSummary } from "./newTermForm";

const SHOWN = 3; // the first subjects are listed, the rest are counted
const DAY = { weekday: "short", month: "short", day: "numeric" };

// Step 3 (TR-4): what Apply will do, in two cards, before anything is written. `timetable` is the main
// timetable's name. A refusal from the server shows above the buttons, and Back keeps everything typed.
export default function ReviewStep({ form, subjects, timetable, message, applying, onBack, onApply }) {
  const archived = subjects.filter((subject) => form.archiveIds.includes(subject._id));
  const added = filledSubjects(form);
  const times = classTimeCount(form);
  const start = form.firstDay
    ? `Classes start ${fromISODate(form.firstDay).toLocaleDateString("en-US", DAY)}.`
    : "No first day set, so they show in every week.";

  return (
    <>
      {archived.length > 0 && (
        <section className="term-summary" aria-label="Subjects to archive">
          <div className="term-summary__head">
            <span className="term-summary__tile"><Archive size={20} aria-hidden="true" /></span>
            <h3 className="term-summary__title">Archive {plural(archived.length, "subject")}</h3>
          </div>
          <ul className="term-chips">
            {archived.map((subject) => (
              <li key={subject._id}><Chip tone="neutral">{subject.name}</Chip></li>
            ))}
          </ul>
        </section>
      )}
      {added.length > 0 && (
        <section className="term-summary" aria-label="Subjects to add">
          <div className="term-summary__head">
            <span className="term-summary__tile"><CalendarPlus size={20} aria-hidden="true" /></span>
            <div className="term-summary__text">
              <h3 className="term-summary__title">
                Add {plural(added.length, "subject")}{times > 0 && ` with ${plural(times, "class time")}`}
              </h3>
              {times > 0 && <p className="term-summary__sub">To {timetable}, your main timetable. {start}</p>}
            </div>
          </div>
          <ul className="term-summary__rows">
            {added.slice(0, SHOWN).map((subject) => (
              <li key={subject.key} className="term-summary__row">
                <span className="term-summary__name">{subject.name}</span>
                <span className="term-summary__when">{scheduleSummary(subject)}</span>
              </li>
            ))}
          </ul>
          {added.length > SHOWN && <p className="term-summary__more">and {plural(added.length - SHOWN, "more subject")}</p>}
        </section>
      )}
      <p className="term-note">
        <Archive size={20} aria-hidden="true" />
        <span>Group and shared timetables are not touched. If a class time is already in your timetable, we skip it.</span>
      </p>
      {message && <p className="term-error" role="alert">{message}</p>}
      <div className="term-actions">
        <Button variant="secondary" disabled={applying} onClick={onBack}>Back</Button>
        <Button icon={Check} busy={applying} onClick={onApply}>{applying ? "Applying" : "Apply changes"}</Button>
      </div>
    </>
  );
}
