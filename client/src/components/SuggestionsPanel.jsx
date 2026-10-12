import { CalendarClock } from "lucide-react";
import { useMoveSuggestions, applyMove, shortDate } from "../utils/moveSuggestions";

// The full list of ideas for lightening the week (Wellbeing). Today shows only the first one.
export default function SuggestionsPanel({ work }) {
  const { visible, dismiss } = useMoveSuggestions({
    userId: work.userId, tasks: work.activeTasks, fixedTasks: work.examTasks, profile: work.profile,
    overview: work.overview, strained: work.strained, now: work.now,
  });
  if (visible.length === 0) {
    return <p className="suggestion-note">Nothing needs moving right now. Your week fits as it is.</p>;
  }
  return (
    <>
      <ul className="suggestion-list">
        {visible.map((sug) => (
          <li key={`${sug.taskId}:${sug.toDate}`} className="suggestion">
            <CalendarClock size={20} aria-hidden="true" />
            <div className="suggestion-body">
              <strong>Move "{sug.title}" to {shortDate(sug.toDate)}</strong>
              <span className="suggestion-dates">
                {sug.course} · now due {shortDate(sug.fromDate)}, {sug.shift} {sug.shift === 1 ? "day" : "days"} later
              </span>
              <p>{sug.why}</p>
              <div className="suggestion-actions">
                <button type="button" className="primary-button small" onClick={() => applyMove(sug, work.updateTask)}>Move it</button>
                <button type="button" className="ghost-button small" onClick={() => dismiss(sug)}>Not now</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="suggestion-note">Only move a deadline you can really change. If a teacher set it, ask them first.</p>
    </>
  );
}
