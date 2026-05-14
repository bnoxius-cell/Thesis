import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../App.css";

export default function About() {
  return (
    <div className="app">
      <Header />
      <main className="dashboard">
        {/* Hero Section */}
        <section className="hero" id="about-hero">
          <div className="hero-copy">
            <span className="eyebrow">About StressCare</span>
            <h1>Web‑Based Stress Management Support System</h1>
            <p>
              Designed specifically for IT students of Our Lady of Fatima University.
              StressCare helps you understand and manage academic stress through data‑driven
              workload analysis.
            </p>
          </div>
          <aside className="hero-panel">
            <h2>At a glance</h2>
            <ul className="hero-list">
              <li>Workload Indicator Algorithm</li>
              <li>Real‑time stress classification</li>
              <li>Personalized recommendations</li>
              <li>Task & deadline tracking</li>
              <li>Weekly pressure forecast</li>
            </ul>
          </aside>
        </section>

        {/* Main content grid */}
        <section className="grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Our approach</span>
                <h2>Beyond subjective self‑assessments</h2>
              </div>
            </div>
            <p>
              Unlike traditional stress management tools that rely solely on subjective
              self‑assessments, StressCare introduces a <strong>Workload Indicator Algorithm</strong>.
              It estimates stress levels based on measurable academic factors:
            </p>
            <ul style={{ marginTop: "1rem", paddingLeft: "1.5rem" }}>
              <li>Task load and estimated hours</li>
              <li>Study hours per day</li>
              <li>Deadline proximity</li>
              <li>Sleep patterns</li>
            </ul>
            <p style={{ marginTop: "1rem" }}>
              This allows the system to provide a more structured and objective representation of
              student workload pressure.
            </p>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">How it helps</span>
                <h2>Real‑time feedback & smart planning</h2>
              </div>
            </div>
            <p>
              The system generates real‑time stress level classifications (Low, Moderate, High)
              and provides corresponding recommendations to help students manage their time,
              improve productivity, and reduce academic overload.
            </p>
            <p style={{ marginTop: "1rem" }}>
              These suggestions support students in developing better study habits and
              maintaining a balanced academic lifestyle.
            </p>
          </section>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Important note</span>
              <h2>Decision‑support & awareness tool</h2>
            </div>
          </div>
          <p>
            StressCare <strong>is not intended to diagnose or treat psychological conditions</strong>.
            Instead, it serves as a decision‑support and awareness tool that helps students
            better understand how their academic responsibilities may contribute to stress.
          </p>
          <p style={{ marginTop: "1rem" }}>
            By visualizing workload and offering structured feedback, the system encourages
            proactive stress management and improved academic planning.
          </p>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Why IT students?</span>
              <h2>Built for Fatima’s computing community</h2>
            </div>
          </div>
          <p>
            This system is particularly relevant for IT students who often experience heavy
            workloads due to programming tasks, projects, and deadlines. Through StressCare,
            students are given a simple yet effective way to monitor their academic pressure
            and make informed decisions about their workload management.
          </p>
          <div className="hero-metrics" style={{ marginTop: "1.5rem" }}>
            <div className="metric-card">
              <span>Algorithm basis</span>
              <strong>Workload</strong>
              <p>Task hours + difficulty + importance + urgency</p>
            </div>
            <div className="metric-card">
              <span>Stress bands</span>
              <strong>Balanced · Watchlist · High Pressure</strong>
              <p>Actionable insights for each level</p>
            </div>
            <div className="metric-card">
              <span>Target audience</span>
              <strong>Fatima IT students</strong>
              <p>School email domain required</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}