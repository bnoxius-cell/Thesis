import { CalendarClock, Heart, Moon, Footprints, Smile, Leaf } from "lucide-react";
import useWorkload from "../utils/useWorkload";
import { isStrained } from "../utils/suggestions";
import { useMoveSuggestions, applyMove, shortDate } from "../utils/moveSuggestions";
import { tomorrowSleepPlan } from "../utils/sleepPlan";
import { finishedThisWeek } from "../utils/doneThisWeek";
import { buildCheckInResult } from "../utils/checkinResult";

const TODAY_ICON = { sleep: Moon, "small-task": Footprints, enjoy: Smile, steady: Leaf };

// The last step of a check-in: what the score means, what changed in the plan, one small thing
// for today, and some credit. Everything comes from data the app already has (see
// utils/checkinResult.js). Reads the week itself so it works from any page.
export default function CheckInResult({ kind, score, previousScore, onDone }) {
  const work = useWorkload();

  if (work.loading || !work.userData) {
    return <p className="checkin-loading">Working out what this means for your week...</p>;
  }

  const pssScore = kind === "pss" ? score : work.pss.score;
  const whoScore = kind === "who" ? score : work.who.score;
  const strained = isStrained({ band: work.insights.band, pssScore, whoScore });
  return (
    <ResultBody
      work={work} kind={kind} score={score} previousScore={previousScore}
      pssScore={pssScore} whoScore={whoScore} strained={strained} onDone={onDone}
    />
  );
}

function ResultBody({ work, kind, score, previousScore, pssScore, whoScore, strained, onDone }) {
  const { visible, dismiss } = useMoveSuggestions({
    userId: work.userId, tasks: work.activeTasks, fixedTasks: work.examTasks, profile: work.profile,
    overview: work.overview, strained, now: work.now,
  });
  const smallest = [...work.activeTasks].sort((a, b) => (a.hours || 0) - (b.hours || 0))[0];
  const result = buildCheckInResult({
    kind, score, previousScore, pssScore, whoScore, strained,
    suggestion: visible[0] || null,
    sleep: tomorrowSleepPlan({ week: work.week, profile: work.profile }),
    smallestTask: smallest?.title || "",
    finishedCount: finishedThisWeek(work.tasks, work.now).length,
  });
  const sug = result.plan.suggestion;
  const TodayIcon = TODAY_ICON[result.today.kind] || Leaf;

  return (
    <div className="checkin-result">
      <section className="checkin-block">
        <h3>What it means</h3>
        <p className="checkin-meaning">{result.meaning} {result.directionText}</p>
        <p className="checkin-score">{result.scoreLine}</p>
      </section>

      <section className="checkin-block">
        <h3>What we changed in your plan</h3>
        {sug && (
          <div className="checkin-move">
            <CalendarClock size={20} aria-hidden="true" />
            <div>
              <strong>Move "{sug.title}" to {shortDate(sug.toDate)}</strong>
              <p>{sug.why}</p>
              <div className="suggestion-actions">
                <button type="button" className="primary-button small" onClick={() => applyMove(sug, work.updateTask)}>Move it</button>
                <button type="button" className="ghost-button small" onClick={() => dismiss(sug)}>Not now</button>
              </div>
            </div>
          </div>
        )}
        {result.plan.warnSooner && <p>We'll warn you sooner when a day gets full.</p>}
        {result.plan.fits && <p>Your week fits as it is. We'll keep an eye on it.</p>}
      </section>

      <section className="checkin-block">
        <h3>One thing for today</h3>
        <div className="checkin-today">
          <TodayIcon size={20} aria-hidden="true" />
          <p>{result.today.text}</p>
        </div>
      </section>

      <section className="checkin-block checkin-cheer">
        <Heart size={18} aria-hidden="true" />
        <div>{result.encouragement.map((line) => <p key={line}>{line}</p>)}</div>
      </section>

      <div className="modal-actions">
        <button type="button" className="primary-button" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}
