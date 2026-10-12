import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import WorkloadChart from "../components/WorkloadChart";
import PSSSurveyModal from "../components/PSSSurveyModal";
import WHOSurveyModal from "../components/WHOSurveyModal";
import CheckInBanner from "../components/CheckInBanner";
import PageTour from "../components/PageTour";
import EmptyState from "../components/EmptyState";
import SetupChecklist, { setupState } from "../components/today/SetupChecklist";
import NextStepCard from "../components/today/NextStepCard";
import { DASHBOARD_TOUR } from "../utils/tours";
import JoinLink from "../components/schedule/JoinLink";
import { CalendarDays, MapPin, CircleCheck, Plus, Sprout } from "lucide-react";
import { formatTime, fromISODate } from "../utils/scheduleUtils";
import useWorkload from "../utils/useWorkload";
import { finishedThisWeek } from "../utils/doneThisWeek";
import { BAND_MESSAGE, bandLabel, topReasons } from "../utils/weekReasons";
import "../App.css";

// "Tuesday, Sep 29. 2 classes left today and 2 tasks due soon."
function summarizeDay(day, focus) {
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const isClass = (e) => e.kind === "class";
  const left = [...focus.happeningNow, ...focus.laterToday].filter(isClass).length;
  const total = day.entries.filter(isClass).length;
  const bits = [];
  if (day.holiday) bits.push(`a day off for ${day.holiday}`);
  else if (left) bits.push(`${left} ${left === 1 ? "class" : "classes"} ${left === total ? "today" : "left today"}`);
  else if (total) bits.push("classes are done for today");
  const due = focus.dueSoon.length;
  if (due) bits.push(`${due} ${due === 1 ? "task" : "tasks"} due soon`);
  const sentence = bits.join(" and ");
  return bits.length ? `${date}. ${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.` : `${date}. Nothing pressing today.`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// The ring is teal while the week is Light or Steady and amber once it's Full or worse. Never red.
const BAND_SEVERITY = {
  "Light Workload": "calm",
  "Moderate Workload": "steady",
  "Heavy Workload": "full",
  "Critical Overload": "a-lot",
};

// Shown when nothing is on and nothing is due, worded for the time of day.
const QUIET_MESSAGE = {
  morning: "A clear morning. A good time to get ahead on something, or just to breathe.",
  afternoon: "Nothing on and nothing due. Enjoy the breathing room.",
  evening: "Nothing left for today. You can switch off.",
  night: "Nothing left for today. Time to rest.",
};

const shortDate = (iso) => fromISODate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const MAX_DUE_SOON = 3;
const SETUP_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function EntryList({ entries, label, live = false }) {
  return (
    <ul className="today-list today-classes" aria-label={label}>
      {entries.map((entry, i) => (
        <li key={`${entry.title}-${entry.startTime}-${i}`} className={`today-item${live ? " is-live" : ""}`}>
          <span className={`today-dot ${entry.kind || "class"}`} aria-hidden="true" />
          <div>
            <strong>{entry.title}{live && <span className="today-now-pill">Now</span>}{entry.kind === "exam" && <span className="today-exam-pill">Exam</span>}{entry.kind === "event" && <span className="today-event-pill">Event</span>}</strong>
            <span className="today-meta">
              {formatTime(entry.startTime)} to {formatTime(entry.endTime)}
              {entry.location && <> · <MapPin size={12} aria-hidden="true" /> {entry.location}</>}
            </span>
          </div>
          {entry.meetingUrl && <JoinLink url={entry.meetingUrl} className={`today-join${live ? " is-live" : ""}`} />}
        </li>
      ))}
    </ul>
  );
}

const Dashboard = () => {
  const work = useWorkload();
  const [showPSSModal, setShowPSSModal] = useState(false);
  const [showWHOModal, setShowWHOModal] = useState(false);
  const [setupHidden, setSetupHidden] = useState(null);

  if (!work.isLoggedin) return <div className="app auth-layout"><Header /><main className="dashboard"><p>Please log in to view your dashboard.</p></main><Footer /></div>;
  if (work.loading || !work.userData) return <div className="app app-layout"><Header /><main className="dashboard"><div className="panel" style={{ textAlign: "center" }}><p>Loading your day...</p></div></main><Footer /></div>;

  const { insights, today, focus, nextExam, hasSchedule, week, userId, profile } = work;
  const doneCount = finishedThisWeek(work.tasks, work.now).length;
  const firstName = profile.studentName?.split(" ")[0];
  const showTodayEntries = focus.happeningNow.length + focus.laterToday.length > 0;
  const dueNow = focus.dueSoon.slice(0, MAX_DUE_SOON);
  const dueMore = focus.dueSoon.length - dueNow.length;

  const setup = setupState({ userData: work.userData, hasSchedule, taskCount: work.tasks.length, profile });
  const createdAt = work.userData.createdAt ? new Date(work.userData.createdAt).getTime() : 0;
  const recentAccount = createdAt > 0 && work.now.getTime() - createdAt < SETUP_WINDOW_MS;
  const hideSetup = setupHidden ?? setup.hidden;
  const showSetup = !setup.complete && !hideSetup && (insights.isNewUser || recentAccount);

  const hideSetupCard = () => {
    try { localStorage.setItem(`stresscare:setup-hidden:${userId}`, "1"); } catch { /* private mode */ }
    setSetupHidden(true);
  };

  const dueThisWeek = work.plannedTasks.filter((task) => {
    const days = Math.round((new Date(task.dueDate) - work.now) / 86400000);
    return days <= 6;
  }).length;
  const reasons = topReasons(insights.parts, dueThisWeek);

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <CheckInBanner
          isOpen
          pssDue={work.pssDue}
          whoDue={work.whoDue}
          onSelectPSS={() => setShowPSSModal(true)}
          onSelectWHO={() => setShowWHOModal(true)}
          onDismiss={() => work.snooze(...[work.pssDue && "PSS", work.whoDue && "WHO"].filter(Boolean))}
        />

        <section className="greeting" id="dashboard" data-tour="dash-greeting">
          <h1>{getGreeting()}{firstName ? `, ${firstName}` : ""}.</h1>
          <p>{insights.isNewUser ? "Here's your space. Let's get it set up." : summarizeDay(today, focus)}</p>
        </section>

        {insights.isNewUser ? (
          showSetup ? (
            <SetupChecklist work={work} setup={setup} onStartCheckIn={() => setShowPSSModal(true)} onHide={hideSetupCard} />
          ) : (
            <section className="panel">
              <EmptyState icon={Sprout} title="Nothing here yet">
                Add a task or your classes and your week starts to take shape.
                <span className="empty-state-actions">
                  <Link to="/schedule?task=new" className="primary-button">Add a task</Link>
                  <Link to="/schedule" className="secondary-button">Open schedule</Link>
                </span>
              </EmptyState>
            </section>
          )
        ) : (
          <>
            <section className="grid today-grid">
              <section className="panel" data-tour="dash-today">
                <div className="panel-heading"><div><span className="panel-kicker">{focus.kicker}</span><h2>{focus.heading}</h2></div></div>

                {today.holiday && (
                  <p className="today-holiday"><CalendarDays size={16} aria-hidden="true" /> {today.holiday}. Classes that skip holidays are off today.</p>
                )}

                {nextExam && nextExam.daysLeft > 0 && (
                  <p className="today-exam-note">
                    <CalendarDays size={16} aria-hidden="true" />
                    <span>Next exam: <strong>{nextExam.title}</strong>, {shortDate(nextExam.date)} at {formatTime(nextExam.startTime)}</span>
                  </p>
                )}

                {focus.happeningNow.length > 0 && <EntryList entries={focus.happeningNow} label="Happening now" live />}

                {focus.laterToday.length > 0 && (
                  <>
                    {focus.happeningNow.length > 0 && <h3 className="today-subhead">Later today</h3>}
                    <EntryList entries={focus.laterToday} label="Later today" />
                  </>
                )}

                {focus.finishedCount > 0 && (
                  <p className="today-finished">{focus.finishedCount} finished earlier today</p>
                )}

                {dueNow.length > 0 && (
                  <>
                    {(showTodayEntries || focus.finishedCount > 0) && <h3 className="today-subhead">Due soon</h3>}
                    <ul className="today-list">
                      {dueNow.map((task) => (
                        <li key={task._id} className="today-item">
                          <span className={`today-dot ${task.status.toLowerCase().replace(/\s+/g, "-")}`} aria-hidden="true" />
                          <div>
                            <strong>{task.title}</strong>
                            <span className="today-meta">{task.course} · {task.daysLeft < 0 ? "overdue" : task.daysLeft === 0 ? "due today" : "due tomorrow"}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {dueMore > 0 && <Link to="/schedule?tab=tasks" className="today-more">+{dueMore} more in Tasks</Link>}
                  </>
                )}

                {focus.caughtUp ? (
                  <div className="caught-up">
                    <CircleCheck size={22} aria-hidden="true" />
                    <div>
                      <strong>You're all caught up</strong>
                      <p>No open tasks right now. Enjoy it, or use the time to plan ahead.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {focus.dueSoon.length === 0 && focus.nextTask && (
                      <p className="today-next">
                        Nothing due right now. Next up is <strong>{focus.nextTask.title}</strong>, due in {focus.nextTask.daysLeft} days.
                      </p>
                    )}
                    {focus.dueSoon.length === 0 && !showTodayEntries && focus.finishedCount === 0 && (
                      <p className="today-empty">{today.holiday ? "A day off, and nothing due. Enjoy it." : QUIET_MESSAGE[focus.phase]}</p>
                    )}
                  </>
                )}

                {focus.tomorrow && (
                  <>
                    <h3 className="today-subhead">Tomorrow</h3>
                    {focus.tomorrow.holiday && (
                      <p className="today-holiday"><CalendarDays size={16} aria-hidden="true" /> {focus.tomorrow.holiday}. A day off.</p>
                    )}
                    {focus.tomorrow.entries.length > 0 ? (
                      <>
                        <EntryList entries={focus.tomorrow.entries} label="Tomorrow" />
                        {focus.tomorrow.moreEntries > 0 && <p className="today-finished">and {focus.tomorrow.moreEntries} more</p>}
                      </>
                    ) : !focus.tomorrow.holiday && (
                      <p className="today-finished">Nothing scheduled tomorrow.</p>
                    )}
                  </>
                )}

                <div className="today-actions">
                  <Link to="/schedule?task=new" className="ghost-button today-add"><Plus size={16} aria-hidden="true" /> Add task</Link>
                  <Link to="/schedule" className="ghost-button today-add"><CalendarDays size={16} aria-hidden="true" /> {hasSchedule ? "Open schedule" : "Add your classes"}</Link>
                </div>
              </section>

              <aside className="hero-panel week-card" data-tour="dash-doing">
                <span className="week-card-kicker">This week</span>
                <div className={`stress-ring ${BAND_SEVERITY[insights.band]}`}>
                  <div className="stress-ring-inner">
                    <strong>{bandLabel(insights.band)}</strong>
                  </div>
                </div>
                <p className="week-card-message">{BAND_MESSAGE[insights.band]}</p>
                <ul className="week-card-reasons">
                  {reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                <Link to="/wellbeing" className="week-card-link">See what's behind this</Link>
              </aside>
            </section>

            {showSetup ? (
              <SetupChecklist work={work} setup={setup} onStartCheckIn={() => setShowPSSModal(true)} onHide={hideSetupCard} />
            ) : (
              <NextStepCard work={work} />
            )}

            <section className="panel week-strip" data-tour="dash-week">
              <div className="panel-heading"><div><span className="panel-kicker">The next 7 days</span><h2>How your week adds up</h2></div></div>
              <Link to="/wellbeing#week" className="week-strip-link" aria-label="See your week in detail">
                <WorkloadChart schedule={week} hasSchedule={hasSchedule} compact />
              </Link>
            </section>

            {doneCount > 0 && (
              <p className="done-this-week">
                {doneCount === 1 ? "You finished 1 task in the last 7 days." : `You finished ${doneCount} tasks in the last 7 days.`} That counts.
              </p>
            )}
          </>
        )}
      </main>
      <Footer variant="app" />
      <PageTour page="dashboard" title="Today" steps={DASHBOARD_TOUR} />

      {/* Mounted only while open, so each one starts from a clean slate. */}
      {showPSSModal && (
        <PSSSurveyModal

          isFirstTime={work.pssNeverTaken}
          onClose={() => setShowPSSModal(false)}
          onComplete={() => { setShowPSSModal(false); work.refreshUser(); }}
          onRemindLater={() => { work.snooze("PSS"); setShowPSSModal(false); }}
        />
      )}

      {showWHOModal && (
        <WHOSurveyModal

          isFirstTime={work.whoNeverTaken}
          onClose={() => setShowWHOModal(false)}
          onComplete={() => { setShowWHOModal(false); work.refreshUser(); }}
          onRemindLater={() => { work.snooze("WHO"); setShowWHOModal(false); }}
        />
      )}
    </div>
  );
};

export default Dashboard;
