import { useState, useRef, useEffect } from "react";
import axios from "axios";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import "../../App.css";
import "./AuthPage.css";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from '@react-oauth/google';

const SCHOOL_EMAIL_DOMAIN = "@student.fatima.edu.ph";

const AuthPage = () => {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'verify'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // OTP state and refs for the 6-cell input
  const [otp, setOtp] = useState(Array(6).fill(''));
  const inputRefs = useRef([]);

  // 3-minute (180 seconds) countdown timer
  const [resendTimer, setResendTimer] = useState(0);

  const { backendUrl, setIsLoggedin, getUserData, userData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Lock unverified users into the OTP screen on page refresh
  useEffect(() => {
    if (userData && userData.isAccountVerified === false) {
      setAuthMode('verify');
      // Optional: Start the timer when they are loaded into the verify screen
      setResendTimer(180);
    }
  }, [userData]);

  const handleOtpChange = (e, index) => {
    const value = e.target.value;
    if (value && /[^0-9]/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
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
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    
    const focusIndex = Math.min(pastedData.length, 5);
    if (inputRefs.current[focusIndex]) {
      inputRefs.current[focusIndex].focus();
    }
  };

  const onVerifySubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      toast.error('Please enter a 6-digit OTP.');
      return;
    }
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/auth/verify-email`,
        { otp: otpCode },
        { withCredentials: true }
      );
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

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return; // Prevent double clicks during cooldown
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/auth/send-verify-otp`,
        {},
        { withCredentials: true }
      );
      if (data.success) {
        toast.success('Verification code resent to your email.');
        setResendTimer(180); // Start 3-minute cooldown
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend OTP');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/auth/google`,
        { token: credentialResponse.credential },
        { withCredentials: true }
      );
      if (data.success) {
        setIsLoggedin(true);
        await getUserData();
        navigate('/dashboard');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Google Authentication failed');
    }
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();

    try {
      if (authMode === 'login') {
        const { data } = await axios.post(`${backendUrl}/api/auth/login`, { email, password, rememberMe }, { withCredentials: true });
        if (data.success) {
          const userRes = await axios.get(`${backendUrl}/api/user/data`, { withCredentials: true });
          
          if (userRes.data.success && !userRes.data.userData.isAccountVerified) {
            const otpRes = await axios.post(`${backendUrl}/api/auth/send-verify-otp`, {}, { withCredentials: true });
            if (otpRes.data.success) {
              toast.info('Please verify your email to continue.');
              setAuthMode('verify');
              setResendTimer(180);
            } else {
              toast.error(otpRes.data.message);
            }
          } else {
            setIsLoggedin(true);
            await getUserData();
            navigate('/dashboard');
          }
        } else {
          toast.error(data.message);
        }
      } else if (authMode === 'register') {
        const { data } = await axios.post(`${backendUrl}/api/auth/register`, { name, email, password }, { withCredentials: true });
        if (data.success) {
          const otpRes = await axios.post(`${backendUrl}/api/auth/send-verify-otp`, {}, { withCredentials: true });
          if (otpRes.data.success) {
            toast.success('Registration successful! Check your email for the verification code.');
            setAuthMode('verify');
            setResendTimer(180);
          } else {
            toast.error(otpRes.data.message);
          }
        } else {
          toast.error(data.message);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Authentication error');
    }
  }

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
                  : 'We sent a 6-digit verification code to your email. Enter it below to continue.'}
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
                <button type="submit" className="primary-button">
                  Verify Email
                </button>
                <button 
                  type="button" 
                  onClick={handleResendOtp} 
                  className="ghost-button" 
                  style={{ marginTop: '10px' }}
                  disabled={resendTimer > 0}
                >
                  {resendTimer > 0 ? `Resend Code in ${formatTime(resendTimer)}` : 'Resend Code'}
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
                      name="name"
                      placeholder="Juan Dela Cruz"
                      required={authMode === 'register'}
                    />
                  </label>
                )}

                <label>
                  Email
                  <input
                    onChange={e => setEmail(e.target.value)}
                    value={email}
                    type="email"
                    name="email"
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
                    name="password"
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

                <button
                  type="submit"
                  className="primary-button"
                >
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
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="secondary-button"
                >
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