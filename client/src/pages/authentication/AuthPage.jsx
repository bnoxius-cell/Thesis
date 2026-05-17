import { useState, useRef, useEffect } from "react";
import axios from "axios";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import "../../App.css";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from '@react-oauth/google';

const SCHOOL_EMAIL_DOMAIN = "@student.fatima.edu.ph";

const AuthPage = () => {
  const [authMode, setAuthMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [otp, setOtp] = useState(Array(6).fill(''));
  const inputRefs = useRef([]);
  const [resendTimer, setResendTimer] = useState(0);

  const { backendUrl, login, register, googleLogin, setIsLoggedin, getUserData, userData, loading } = useAuth();
  const navigate = useNavigate();

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (!loading && userData?.isAccountVerified === true) {
      navigate('/dashboard');
    } else if (!loading && userData?.isAccountVerified === false) {
      setAuthMode('verify');
      setResendTimer(180);
    }
  }, [loading, userData, navigate]);

  // OTP handlers
  const handleOtpChange = (e, index) => {
    const value = e.target.value;
    if (value && /[^0-9]/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1].focus();
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) newOtp[i] = pastedData[i];
    setOtp(newOtp);
    const focusIndex = Math.min(pastedData.length, 5);
    if (inputRefs.current[focusIndex]) inputRefs.current[focusIndex].focus();
  };

  const onVerifySubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      toast.error('Please enter a 6-digit OTP.');
      return;
    }
    try {
      const { data } = await axios.post(`${backendUrl}/api/auth/verify-email`, { otp: otpCode }, { withCredentials: true });
      if (data.success) {
        toast.success(data.message);
        setIsLoggedin(true);
        await getUserData();
        navigate('/dashboard');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Verification failed');
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    try {
      const { data } = await axios.post(`${backendUrl}/api/auth/send-verify-otp`, {}, { withCredentials: true });
      if (data.success) {
        toast.success('Verification code resent.');
        setResendTimer(180);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend OTP');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    const success = await googleLogin(credentialResponse.credential);
    if (success) navigate('/dashboard');
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    // Validate school email domain
    if (!email.endsWith(SCHOOL_EMAIL_DOMAIN)) {
      toast.error(`Only ${SCHOOL_EMAIL_DOMAIN} emails are allowed.`);
      return;
    }

    if (authMode === 'login') {
      const success = await login(email, password, rememberMe);
      if (success) {
        // After login, the context will have userData; check verification
        if (userData?.isAccountVerified === false) {
          // Not verified – OTP already sent in the login API, just switch mode
          setAuthMode('verify');
          setResendTimer(180);
          toast.info('Please verify your email to continue.');
        } else {
          navigate('/dashboard');
        }
      }
    } else if (authMode === 'register') {
      const result = await register(name, email, password);
      if (result.success && result.needsVerification) {
        setAuthMode('verify');
        setResendTimer(180);
        toast.info('Check your email for the verification code.');
      }
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
              Sign in with your Fatima student email to create tasks, prepare group sharing,
              and keep the first demo loop clear for the panel.
            </p>
            <div className="auth-preview">
              <span>School email login</span>
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
                  ? 'Use your school account to open your dashboard.'
                  : authMode === 'register'
                  ? 'Create the profile used by the task and group modules.'
                  : 'We sent a 6‑digit verification code. Enter it below to continue.'}
              </p>
            </div>

            {authMode === 'verify' ? (
              <form className="auth-form" onSubmit={onVerifySubmit}>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', margin: '12px 0 24px' }}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(e, index)}
                      onKeyDown={(e) => handleOtpKeyDown(e, index)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      ref={(el) => (inputRefs.current[index] = el)}
                      style={{
                        width: '48px',
                        height: '56px',
                        textAlign: 'center',
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        borderRadius: '8px',
                        border: '1px solid var(--input-border)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)'
                      }}
                      required
                    />
                  ))}
                </div>
                <button type="submit" className="primary-button">Verify Email</button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="ghost-button"
                  style={{ marginTop: '10px' }}
                  disabled={resendTimer > 0}
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
                    placeholder={`name${SCHOOL_EMAIL_DOMAIN}`}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    onChange={e => setPassword(e.target.value)}
                    value={password}
                    type="password"
                    placeholder="••••••••"
                    required
                  />
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
                <button type="submit" className="primary-button">
                  {authMode === 'login' ? 'Sign In' : 'Create Account'}
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
                  hosted_domain="student.fatima.edu.ph"
                />
              </div>
            )}

            <div className="auth-actions">
              {authMode === 'verify' ? (
                <button type="button" onClick={() => setAuthMode('login')} className="secondary-button">
                  Back to login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="secondary-button"
                >
                  {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AuthPage;
