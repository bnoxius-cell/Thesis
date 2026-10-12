import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, Eye, Lightbulb, Sparkles } from "lucide-react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import PageHeader from "../components/PageHeader";
import WorkloadChart from "../components/WorkloadChart";
import SuggestionsPanel from "../components/SuggestionsPanel";
import useWorkload from "../utils/useWorkload";
import { BAND_MESSAGE, bandLabel } from "../utils/weekReasons";
import { sleepPlan, firstStartOf } from "../utils/sleepPlan";
import { formatTime } from "../utils/scheduleUtils";
import "../App.css";

const TIP_ICON = { alert: AlertTriangle, watch: Eye, info: Lightbulb, good: Sparkles };
const LEVEL_WORD = { low: "Light", moderate: "Steady", high: "Heavy" };
const DRIVER_SENTENCE = {
  time: { low: "Not much is due soon.", moderate: "A steady amount is due.", high: "A lot is due close together." },
  schedule: { low: "Classes leave you plenty of room.", moderate: "Classes take a fair share of your week.", high: "Classes and activities fill most of your week." },
  stress: { low: "Your stress check-in looks calm.", moderate: "Your stress check-in shows some strain.", high: "Your stress check-in is on the high side." },
  wellbeing: { low: "Your well-being check-in looks good.", moderate: "Your well-being check-in is middling.", high: "Your well-being check-in is low." },
};

// The detail Today leaves out: what is shaping the week, the full chart, every tip and idea.
export default function Wellbeing() {
  const work = useWorkload();
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash || work.loading) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash, work.loading]);

  if (work.loading || !work.userData) {
    return <div className="app app-layout"><Header /><main className="dashboard"><div className="panel" style={{ textAlign: "center" }}><p>Loading...</p></div></main><Footer /></div>;
  }

  const { insights, week, hasSchedule, profile } = work;
  const tomorrow = week[1];
  const plan = tomorrow ? sleepPlan({
    first: firstStartOf(tomorrow.entries),
    travelMinutes: profile.travelMinutesPerDay,
    sleepHours: profile.sleepHours,
    usualSleepStart: profile.hasRegularSleepSchedule ? profile.usualSleepStart : "",
  }) : null;

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <PageHeader
          back={{ to: "/dashboard", label: "Today" }}
          title={insights.isNewUser ? "How you're doing" : bandLabel(insights.band)}
          description={insights.isNewUser ? "Add a task or your classes and this page fills in." : BAND_MESSAGE[insights.band]}
        >
          {!insights.isNewUser && <p className="wellbeing-score">Workload score {insights.workloadScore} of 100</p>}
        </PageHeader>

        {!insights.isNewUser && (
          <>
            <section className="panel" data-tour="well-drivers">
              <div className="panel-heading"><div><h2>What's shaping your week</h2></div></div>
              <ul className="driver-list" aria-label="What's shaping your workload">
                {insights.parts.map((part) => (
                  <li key={part.key} className={`driver driver-${part.level}`}>
                    <span className="driver-label">{part.label}</span>
                    <span className="driver-word">{LEVEL_WORD[part.level]}</span>
                    <span className="driver-track" aria-hidden="true"><span className="driver-fill" style={{ width: `${Math.max(part.value, 4)}%` }} /></span>
                    <span className="driver-note">{DRIVER_SENTENCE[part.key]?.[part.level]}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel" id="week" data-tour="well-week">
              <div className="panel-heading"><div><h2>Your week</h2></div></div>
              <WorkloadChart schedule={week} hasSchedule={hasSchedule} />
            </section>

            <section className="panel insights-panel" data-tour="well-focus">
              <div className="panel-heading"><div><h2>What to focus on</h2></div></div>
              <div className="insight-stack">
                {insights.tips.map((tip) => {
                  const Icon = TIP_ICON[tip.tone];
                  return (
                    <article className={`insight-card tone-${tip.tone}`} key={tip.title}>
                      <span className="insight-icon" aria-hidden="true"><Icon size={16} /></span>
                      <div>
                        <strong>{tip.title}</strong>
                        <p>{tip.text}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="panel suggestions-panel" data-tour="well-ideas">
              <div className="panel-heading"><div><h2>Ideas to lighten the week</h2></div></div>
              <SuggestionsPanel work={work} />
            </section>
          </>
        )}

        <section className="panel" id="sleep" data-tour="well-sleep">
          <div className="panel-heading"><div><h2>Sleep</h2></div></div>
          <p className="wellbeing-sleep">
            You aim for {profile.sleepHours} hours.
            {profile.hasRegularSleepSchedule ? ` You usually go to bed at ${formatTime(profile.usualSleepStart)} and wake at ${formatTime(profile.usualWakeTime)}.` : ""}
          </p>
          <p className="wellbeing-sleep">
            {plan ? plan.text : "Nothing early tomorrow, so keep your usual bedtime."}
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
