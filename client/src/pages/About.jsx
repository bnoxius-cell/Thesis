import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import PageHeader from "../components/PageHeader";
import { useAuth } from "./authentication/AuthContext";
import { SUPPORT_EMAILS } from "./legal/legalContent";
import { PSS_VALID_DAYS, WHO_VALID_DAYS } from "../utils/workload";
import "../App.css";

const STEPS = [
  ["Add your classes", "Build your timetable once. Exams, activities and days off go on it too."],
  ["Add your tasks", "Give each one a due date, the hours it needs, and how hard and important it is."],
  ["Take the check-ins", "Two short questionnaires, one about stress and one about well-being. They take a couple of minutes."],
  ["Follow the plan", "StressCare shows how full your week is, which day is the heaviest, and what to move or do next."],
];

const BANDS = [
  ["Light week", "0 to 30", "There's room. A good week to get ahead or rest."],
  ["Steady week", "31 to 60", "A normal load. Keep your routine."],
  ["Full week", "61 to 80", "A lot on. Worth moving something or protecting your sleep."],
  ["Too much this week", "81 to 100", "More than fits. The app suggests what to move, and when."],
];

const INPUTS = [
  "Deadlines against the study time you actually have free each day",
  "The busiest single day",
  "How much of the week classes and activities already take",
  "Your latest stress check-in",
  "Your latest well-being check-in",
  "How much of your task time is high importance",
  "How much of your task time is difficult",
];

export default function About() {
  const { isLoggedin } = useAuth();

  return (
    <div className={`app ${isLoggedin ? "app-layout" : "auth-layout"}`}>
      <Header />
      <main className="dashboard about-page">
        <PageHeader
          kicker="About"
          title="About StressCare"
          description="A planner for OLFU IT students that shows how full your week is and helps you keep it manageable."
        />

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">What it is</span>
              <h2>Your classes, deadlines and check-ins in one place</h2>
            </div>
          </div>
          <p>
            StressCare puts your timetable, tasks and two short check-ins together. It works out how heavy the
            week is from real numbers, such as hours of work against hours you have free, instead of guessing.
            When a week is too full, it suggests what to move and when to rest.
          </p>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">How it works</span>
              <h2>Four steps</h2>
            </div>
          </div>
          <ol className="about-steps">
            {STEPS.map(([title, text]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">The workload score</span>
              <h2>How we work out how full your week is</h2>
            </div>
          </div>
          <p>The score runs from 0 to 100 and is built from these, each weighted by how much it matters:</p>
          <ul className="about-list">
            {INPUTS.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p>
            Anything you haven't filled in is left out, and the rest count for more. It never pretends a missing
            check-in is average. A stress check-in counts for {PSS_VALID_DAYS} days and a well-being check-in for{" "}
            {WHO_VALID_DAYS} days, because an old result may not describe you any more.
          </p>
          <p>
            A few things then move the score by a set number of points: an exam within 7 days adds 8 (15 if it is
            within 2 days or you have two in that week, and 15 for a week your schedule marks as exam week), each overdue task adds 3 up to 10, and your pace setting adds 10
            for Lighter or takes off 10 for Fuller, unless a check-in says you're struggling.
          </p>
          <p>Your score lands in one of four weeks:</p>
          <dl className="about-bands">
            {BANDS.map(([name, range, text]) => (
              <div key={name}>
                <dt>{name} <span>{range}</span></dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">The check-ins</span>
              <h2>Two questionnaires researchers already use</h2>
            </div>
          </div>
          <ul className="about-list">
            <li>
              <strong>Stress:</strong> the Perceived Stress Scale (PSS-10), Cohen, Kamarck and Mermelstein, 1983.
            </li>
            <li>
              <strong>Well-being:</strong> the WHO-5 Well-Being Index, World Health Organization, 1998.
            </li>
          </ul>
          <p>
            The scores help StressCare know you and adjust your plan. They aren't shown to other students.
          </p>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">What it isn't</span>
              <h2>Not a diagnosis, not treatment</h2>
            </div>
          </div>
          <p>
            StressCare is a planning and awareness tool. It doesn't diagnose or treat anything. If things feel
            like too much, you can find people to talk to under Me, in Help and more.
          </p>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Who made it</span>
              <h2>A thesis project</h2>
            </div>
          </div>
          <p>
            Made by <span className="about-placeholder">[team member names]</span> as a thesis project at Our Lady of
            Fatima University.
          </p>
          <p>
            Questions or problems? Email{" "}
            {SUPPORT_EMAILS.map((e, i) => (
              <span key={e}>{i > 0 && " or "}<a href={`mailto:${e}`}>{e}</a></span>
            ))}
            .
          </p>
        </section>
      </main>
      <Footer variant="full" />
    </div>
  );
}
