import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import "../../App.css";

const SCHOOL_EMAIL_DOMAIN = "@student.fatima.edu.ph";

const AuthPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="app">
      <Header />
      <main className="auth-page">
        <section className="auth-shell" id="login">
          <div className="auth-copy">
            <span className="eyebrow">Student workload system</span>
            <h1>Plan personal tasks and group work from one dashboard.</h1>
            <p>
              Sign in with your Fatima student email to create tasks, prepare group sharing,
              and keep the first demo loop clear for the panel.
            </p>

            <div className="auth-preview" aria-label="Phase one demo flow">
              <span>School email login</span>
              <span>Personal task board</span>
              <span>Group-ready workflow</span>
            </div>
          </div>
          <div className="auth-card">
            <div className="auth-card-header">
              <span className="panel-kicker">{isLogin ? 'Welcome back' : 'Create profile'}</span>
              <h2>{isLogin ? 'Sign in' : 'Student signup'}</h2>
              <p>
                {isLogin
                  ? 'Use your school account to open your dashboard.'
                  : 'Create the profile used by the task and group modules.'}
              </p>
            </div>

            {error && (
              <div className="form-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              {!isLogin && (
                <label>
                  Full Name
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Juan Dela Cruz"
                    required={!isLogin}
                  />
                </label>
              )}

              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder={`name${SCHOOL_EMAIL_DOMAIN}`}
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="primary-button"
              >
                {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="auth-actions">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsLogin((current) => !current);
                }}
                className="secondary-button"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
              <button
                type="button"
                onClick={handleSignupAccess}
                className="ghost-button"
              >
                Continue as demo student
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AuthPage;