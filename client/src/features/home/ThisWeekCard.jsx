import { Link } from "react-router-dom";
import { ChartColumn } from "lucide-react";
import { Card, Chip, ProgressBar } from "@/shared/ui";
import WeekBars from "@/features/workload/WeekBars";
import { BAND_TONE } from "@/features/workload/bandTone";
import { weekProgress } from "@/features/workload/weekProgress";

// This week (Figma 16:89): the band, seven bars, one sentence, how many tasks due this week are done,
// the workload note and a way into the details. A new account sees one line instead.
export default function ThisWeekCard({ work, tasks, now }) {
  const { reading, week, heaviest, insights } = work;
  const progress = weekProgress(tasks, now);

  return (
    <Card as="section" className="home-week" aria-labelledby="home-week">
      <header className="home-card__head">
        <span className="home-chip home-chip--soft" aria-hidden="true"><ChartColumn size={18} /></span>
        <h2 id="home-week" className="home-card__title">This week</h2>
        {!insights.isNewUser && <Chip tone={BAND_TONE[reading.band]}>{reading.label}</Chip>}
      </header>

      {insights.isNewUser ? (
        <p className="home-card__empty">Add your classes or a task, and your week shows up here.</p>
      ) : (
        <>
          <WeekBars days={week} heaviestKey={heaviest?.key ?? null} />
          <p className="home-week__sentence">{heaviest ? `${heaviest.name} looks heaviest.` : reading.headline}</p>
          {progress.total > 0 && (
            <div className="home-week__progress">
              <ProgressBar
                value={progress.done / progress.total}
                tone={progress.done === progress.total ? "good" : "accent"}
                label="Tasks due this week that are done"
                valueText={`${progress.done} of ${progress.total} done`}
              />
              <p className="home-week__count">{progress.done} of {progress.total} done</p>
            </div>
          )}
          <p className="home-week__note">{reading.note}</p>
          <Link to="/wellbeing#load" className="home-link">Details</Link>
        </>
      )}
    </Card>
  );
}
