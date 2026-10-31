import { ChartColumn } from "lucide-react";
import { Card, Chip } from "@/shared/ui";
import WeekBars from "@/features/workload/WeekBars";
import { BAND_TONE } from "@/features/workload/bandTone";
import { heaviestDetail } from "./loadSummary";
import WellbeingEmpty from "./WellbeingEmpty";
import WhyPanel from "./WhyPanel";

// This week's load (Figma 51:2, 52:117): the band, which day is heaviest, the seven bars with their key
// and the workload note, with a Why disclosure underneath. A new account sees the empty body (53:459).
// It carries the page's one ambient layer. `work` comes from useWorkload.
export default function LoadHero({ work, moves }) {
  const { reading, week, heaviest, insights, enrichedTasks } = work;
  const heaviestDay = heaviest && week.find((day) => day.key === heaviest.key);

  return (
    <Card as="section" id="load" className="wellbeing-hero ambient" aria-labelledby="wellbeing-load">
      <header className="wellbeing-hero__head">
        <span className="wellbeing-chip wellbeing-chip--surface" aria-hidden="true"><ChartColumn size={18} /></span>
        <h2 id="wellbeing-load" className="wellbeing-hero__heading">This week's load</h2>
        {!insights.isNewUser && <Chip tone={BAND_TONE[reading.band]}>{reading.label}</Chip>}
      </header>

      {insights.isNewUser ? (
        <WellbeingEmpty />
      ) : (
        <>
          <div className="wellbeing-hero__body">
            <div className="wellbeing-hero__text">
              <p className="wellbeing-hero__title">{heaviest ? `${heaviest.name} looks heaviest.` : reading.headline}</p>
              {heaviestDay && (
                <p className="wellbeing-hero__detail">{heaviestDetail(heaviestDay, heaviest.name, enrichedTasks)}</p>
              )}
            </div>
            <div className="wellbeing-hero__chart">
              <WeekBars days={week} heaviestKey={heaviest?.key ?? null} size="lg" legend />
            </div>
            <p className="wellbeing-hero__note">{reading.note}</p>
          </div>
          <WhyPanel reasons={reading.reasons} tips={insights.tips ?? []} moves={moves} />
        </>
      )}
    </Card>
  );
}
