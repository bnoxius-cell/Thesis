import { useState, useRef, useEffect } from "react";
import axios from "axios";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import "../../App.css";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";
import { GoogleLogin } from '@react-oauth/google';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { SUPPORT_EMAILS } from '../legal/legalContent';

const SCHOOL_EMAIL_DOMAIN = "student.fatima.edu.ph";
const RESEND_COOLDOWN_SECONDS = 180;
const OTP_LENGTH = 6;

// Navigation to /dashboard is left to the route guard in App.jsx: it redirects as soon as
// isLoggedin flips, and an extra navigate() here competed with it.
const AuthPage = () => {
  const { theme } = useTheme();
  const [authMode, setAuthMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef([]);
  const [resendTimer, setResendTimer] = useState(0);

  const { backendUrl, login, register, googleLogin, logout, setIsLoggedin, getUserData, userData, loading } = useAuth();

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Returning with a signed-up-but-unverified session: go straight to the verify step.
  // No code was sent on this visit, so Resend stays available. Runs once, after the
  // initial auth check, so it doesn't fight the login/register handlers below.
  const initialCheckDone = useRef(false);
  useEffect(() => {
    if (loading || initialCheckDone.current) return;
    initialCheckDone.current = true;
    if (userData?.isAccountVerified === false) setAuthMode('verify');
  }, [loading, userData]);

  const startVerifyStep = (otpSent) => {
    setOtp(Array(OTP_LENGTH).fill(''));
    setAuthMode('verify');
    // Only lock Resend if a code actually went out; otherwise the user needs it right away.
    setResendTimer(otpSent ? RESEND_COOLDOWN_SECONDS : 0);
  };

  // OTP handlers
  const fillOtp = (digits, startIndex) => {
    const newOtp = [...otp];
    for (let i = 0; i < digits.length && startIndex + i < OTP_LENGTH; i++) {
      newOtp[startIndex + i] = digits[i];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(startIndex + digits.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleOtpChange = (e, index) => {
    const digits = e.target.value.replace(/\D/g, '');
    // More than one digit at once means the browser autofilled the whole code.
    if (digits.length > 1) {
      fillOtp(digits.slice(0, OTP_LENGTH), digits.length >= OTP_LENGTH ? 0 : index);
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);
    if (digits && index < OTP_LENGTH - 1) inputRefs.current[index + 1].focus();
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e, index) => {
    e.preventDefault();
    // Codes copied from an email often carry spaces or a trailing newline.
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!digits) return;
    // A full code always fills from the first box, whichever box it was pasted into.
    fillOtp(digits, digits.length === OTP_LENGTH ? 0 : index);
  };

  const onVerifySubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== OTP_LENGTH) {
      toast.error('Please enter the full 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post(`${backendUrl}/api/auth/verify-email`, { otp: otpCode }, { withCredentials: true });
      if (data.success) {
        toast.success(data.message);
        await getUserData();
        setIsLoggedin(true);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || busy) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`${backendUrl}/api/auth/send-verify-otp`, {}, { withCredentials: true });
      if (data.success) {
        toast.success('We sent you a new code.');
        setOtp(Array(OTP_LENGTH).fill(''));
        setResendTimer(RESEND_COOLDOWN_SECONDS);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend the code');
    } finally {
      setBusy(false);
    }
  };

  // Drops the unverified session cookie too; otherwise a reload lands right back on the verify step.
  const handleBackToLogin = async () => {
    setBusy(true);
    await logout({ silent: true });
    setBusy(false);
    setOtp(Array(OTP_LENGTH).fill(''));
    setResendTimer(0);
    setAuthMode('login');
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      toast.error('Google Login Failed');
      return;
    }
    await googleLogin(credentialResponse.credential);
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (authMode === 'register' && !acceptedTerms) {
      toast.error('Please agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }
    setBusy(true);
    try {
      const result = authMode === 'login'
        ? await login(normalizedEmail, password, rememberMe)
        : await register(name.trim(), normalizedEmail, password, acceptedTerms);

      if (result.success && result.needsVerification) {
        startVerifyStep(result.otpSent);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="app auth-layout">
        <Header />
        <main className="auth-page">
          <div className="auth-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
            <p>Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="app auth-layout">
      <Header />
      <main className="auth-page">
        <section className="auth-shell" id="login">
          <div className="auth-copy">
            <span className="eyebrow">Student workload system</span>
            <h1>Plan personal tasks and group work from one dashboard.</h1>
            <p>
              Make a StressCare account with any email to plan your tasks, share group work
              with classmates, and keep your week manageable.
            </p>
            <div className="auth-preview">
              <span>Email or Google sign-in</span>
              <span>Personal task board</span>
              <span>Group-ready workflow</span>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-card-header">
              <span className="panel-kicker">
                {authMode === 'login' ? 'Welcome back' : authMode === 'register' ? 'Create profile' : 'Verify account'}
              </span>
              <h2>
                {authMode === 'login' ? 'Sign in' : authMode === 'register' ? 'Student signup' : 'Check your email'}
              </h2>
              <p>
                {authMode === 'login'
                  ? 'Sign in with your email, or continue with a Fatima Google account.'
                  : authMode === 'register'
                  ? 'Sign up with any email. Google sign-up is for Fatima student accounts only.'
                  : `Enter the 6-digit code we emailed to ${userData?.email || 'your email'}. It's valid for 20 minutes.`}
              </p>
            </div>

            {authMode === 'verify' ? (
              <form className="auth-form" onSubmit={onVerifySubmit}>
                <div className="otp-input-row">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(e, index)}
                      onKeyDown={(e) => handleOtpKeyDown(e, index)}
                      onPaste={(e) => handleOtpPaste(e, index)}
                      // Selecting on focus lets a typed digit replace the one already there.
                      onFocus={(e) => e.target.select()}
                      ref={(el) => (inputRefs.current[index] = el)}
                      className="otp-input"
                      required
                    />
                  ))}
                </div>
                <button type="submit" className="primary-button" disabled={busy}>
                  {busy ? 'Checking...' : 'Verify Email'}
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="ghost-button"
                  style={{ marginTop: '10px' }}
                  disabled={resendTimer > 0 || busy}
                >
                  {resendTimer > 0 ? `Resend Code in ${Math.floor(resendTimer / 60)}:${(resendTimer % 60).toString().padStart(2, '0')}` : 'Resend Code'}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={onSubmitHandler}>
                {authMode === 'register' && (
                  <label>
                    Full Name
                    <input
                      onChange={e => setName(e.target.value)}
                      value={name}
                      type="text"
                      autoComplete="name"
                      placeholder="Juan Dela Cruz"
                      required
                    />
                  </label>
                )}
                <label>
                  Email
                  <input
                    onChange={e => setEmail(e.target.value)}
                    value={email}
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="you@example.com"
                    required
                  />
                </label>
                <label>
                  Password
                  <div className="password-field">
                    <input
                      onChange={e => setPassword(e.target.value)}
                      value={password}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                      minLength={authMode === 'register' ? 8 : undefined}
                      placeholder={authMode === 'register' ? 'At least 8 characters' : '••••••••'}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </div>
                </label>
                {authMode === 'login' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      id="rememberMe"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ width: '16px', height: '16px', padding: 0, margin: 0, cursor: 'pointer' }}
                    />
                    <label htmlFor="rememberMe" style={{ display: 'inline', fontWeight: 'normal', cursor: 'pointer', fontSize: '0.9rem' }}>
                      Remember me
                    </label>
                  </div>
                )}
                {authMode === 'register' && (
                  <label className="terms-check">
                    <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
                    <span>
                      I agree to the <Link to="/terms-of-service">Terms of Service</Link> and{' '}
                      <Link to="/privacy-policy">Privacy Policy</Link>.
                    </span>
                  </label>
                )}
                <button type="submit" className="primary-button" disabled={busy}>
                  {busy
                    ? (authMode === 'login' ? 'Signing in...' : 'Creating account...')
                    : (authMode === 'login' ? 'Sign In' : 'Create Account')}
                </button>
              </form>
            )}

            {authMode !== 'verify' && (
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '10px' }}>
                  <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--input-border)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>or</span>
                  <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--input-border)' }} />
                </div>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error('Google Login Failed')}
                  text={authMode === 'login' ? 'signin_with' : 'signup_with'}
                  shape="rectangular"
                  hosted_domain={SCHOOL_EMAIL_DOMAIN}
                  theme={theme === 'dark' ? 'filled_black' : 'outline'}
                />
                <p className="auth-legal-note">
                  New to StressCare? Signing in with Google means you agree to our{' '}
                  <Link to="/terms-of-service">Terms</Link> and <Link to="/privacy-policy">Privacy Policy</Link>.
                  We'll ask you to confirm once you're in.
                </p>
              </div>
            )}

            <div className="auth-actions">
              {authMode === 'verify' ? (
                <button type="button" onClick={handleBackToLogin} className="secondary-button" disabled={busy}>
                  Back to login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="secondary-button"
                  disabled={busy}
                >
                  {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </button>
              )}
            </div>
            <p className="auth-support-note">
              Need help? Email{' '}
              {SUPPORT_EMAILS.map((e, i) => (
                <span key={e}>{i > 0 && ' or '}<a href={`mailto:${e}`}>{e}</a></span>
              ))}
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AuthPage;
