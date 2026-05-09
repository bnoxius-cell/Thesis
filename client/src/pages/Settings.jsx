import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { useTheme } from "../context/ThemeContext";
import "../App.css";

export default function Settings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app">
      <Header />
      <main className="dashboard">
        <section className="hero" id="settings-hero">
          <div className="hero-copy">
            <span className="eyebrow">Preferences</span>
            <h1>Appearance & Settings</h1>
            <p>Customize how StressCare looks and behaves.</p>
          </div>
          <aside className="hero-panel">
            <h2>Quick actions</h2>
            <ul className="hero-list">
              <li>Theme switcher</li>
              <li>Data management (coming soon)</li>
              <li>Notification preferences (coming soon)</li>
            </ul>
          </aside>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Theme</span>
              <h2>Choose your color scheme</h2>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <button
              onClick={toggleTheme}
              className={theme === 'light' ? 'primary-button' : 'secondary-button'}
              style={{ minWidth: '120px' }}
            >
              ☀️ Light
            </button>
            <button
              onClick={toggleTheme}
              className={theme === 'dark' ? 'primary-button' : 'secondary-button'}
              style={{ minWidth: '120px' }}
            >
              🌙 Dark
            </button>
            <p style={{ margin: '0', color: 'var(--text-secondary)' }}>
              Currently using <strong>{theme === 'light' ? 'Light' : 'Dark'}</strong> mode.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Account</span>
              <h2>Data & privacy</h2>
            </div>
          </div>
          <p style={{ marginBottom: '1rem' }}>
            Your tasks and profile are stored locally in your browser. No data is sent to external servers.
          </p>
          <button className="secondary-button" disabled style={{ opacity: 0.6 }}>
            Export my data (coming soon)
          </button>
        </section>
      </main>
      <Footer />
    </div>
  );
}