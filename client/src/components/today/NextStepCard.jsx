import { AlertTriangle, CalendarClock, Eye, Lightbulb, Moon, Sparkles } from "lucide-react";
import { useMoveSuggestions, applyMove, shortDate } from "../../utils/moveSuggestions";
import { sleepPlan, firstStartOf } from "../../utils/sleepPlan";

const TIP_ICON = { alert: AlertTriangle, watch: Eye, info: Lightbulb, good: Sparkles };

// Exactly one thing, the first that applies: a bedtime nudge in the evening before an early
// class, then the top idea for moving a deadline, then the top guidance tip. The rest of the
// ideas and tips live on Wellbeing.
export default function NextStepCard({ work }) {
  const { visible, dismiss } = useMoveSuggestions({
    userId: work.userId, tasks: work.activeTasks, fixedTasks: work.examTasks, profile: work.profile,
    overview: work.overview, strained: work.strained, now: work.now,
  });

  const tomorrow = work.week[1];
  const plan = work.now.getHours() >= 18 && tomorrow
    ? sleepPlan({
      first: firstStartOf(tomorrow.entries),
      travelMinutes: work.profile.travelMinutesPerDay,
      sleepHours: work.profile.sleepHours,
      usualSleepStart: work.profile.hasRegularSleepSchedule ? work.profile.usualSleepStart : "",
    })
    : null;

  let body = null;
  if (plan) {
    body = (
      <div className="next-step">
        <span className="next-step-icon" aria-hidden="true"><Moon size={20} /></span>
        <div>
          <strong>Aim for an earlier night</strong>
          <p>{plan.text}</p>
        </div>
      </div>
    );
  } else if (visible[0]) {
    const sug = visible[0];
    body = (
      <div className="next-step">
        <span className="next-step-icon" aria-hidden="true"><CalendarClock size={20} /></span>
        <div>
          <strong>Move "{sug.title}" to {shortDate(sug.toDate)}</strong>
          <p>{sug.why}</p>
          <div className="suggestion-actions">
            <button type="button" className="primary-button small" onClick={() => applyMove(sug, work.updateTask)}>Move it</button>
            <button type="button" className="ghost-button small" onClick={() => dismiss(sug)}>Not now</button>
          </div>
        </div>
      </div>
    );
  } else if (work.insights.tips?.[0]) {
    const tip = work.insights.tips[0];
    const Icon = TIP_ICON[tip.tone] || Lightbulb;
    body = (
      <div className="next-step">
        <span className="next-step-icon" aria-hidden="true"><Icon size={20} /></span>
        <div>
          <strong>{tip.title}</strong>
          <p>{tip.text}</p>
        </div>
      </div>
    );
  }

  if (!body) return null;
  return (
    <section className="panel next-step-card" data-tour="dash-next">
      <span className="panel-kicker">Next step</span>
      {body}
    </section>
  );
}
