import { Link } from 'react-router-dom';
import { Github, Mail } from 'lucide-react';
import Logo from '../../assets/logo.png';
import { useAuth } from '../../pages/authentication/AuthContext';
import { SUPPORT_EMAILS } from '../../pages/legal/legalContent';
import './Footer.css';

// `variant="app"` is the one-line footer for signed-in pages; `"full"` is the public one
// (sign-in, About, legal). Left unset, it follows whether someone is signed in.
export default function Footer({ variant }) {
  const { isLoggedin, user } = useAuth();
  const kind = variant || (isLoggedin ? 'app' : 'full');
  const year = new Date().getFullYear();

  if (kind === 'app') {
    const helpTo = user?._id ? `/profile/${user._id}#help` : '/about';
    return (
      <footer className="footer app-footer">
        <span>&copy; {year} StressCare</span>
        <nav aria-label="Footer">
          <Link to="/privacy-policy">Privacy</Link>
          <Link to="/terms-of-service">Terms</Link>
          <Link to={helpTo}>Help</Link>
        </nav>
      </footer>
    );
  }

  return (
    <footer className="footer site-footer">
      <div className="site-footer-top">
        <div className="site-footer-brand">
          <Link to="/" className="logo-link">
            <img src={Logo} alt="StressCare Logo" className="logo-svg" />
            <div className="logo-text">Stress<span>Care</span></div>
          </Link>
          <p className="site-footer-tagline">
            Plan tasks early, spread the pressure, and protect your energy.
          </p>
          <div className="site-footer-socials">
            <a href="https://github.com/bnoxius-cell/Thesis" target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={20} /></a>
            <a href={`mailto:${SUPPORT_EMAILS.join(',')}`} aria-label="Email Support"><Mail size={20} /></a>
          </div>
        </div>

        <div className="site-footer-links">
          <div className="site-footer-column">
            <h4>Product</h4>
            <Link to="/dashboard">Today</Link>
            <Link to="/schedule">Schedule</Link>
            <Link to="/groups">People</Link>
          </div>
          <div className="site-footer-column">
            <h4>Resources</h4>
            <Link to="/about">About Us</Link>
            <h4 className="site-footer-subhead">Support</h4>
            {SUPPORT_EMAILS.map((e) => (
              <a key={e} href={`mailto:${e}`} className="site-footer-email">{e}</a>
            ))}
          </div>
          <div className="site-footer-column">
            <h4>Legal</h4>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-service">Terms of Service</Link>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p>&copy; {year} StressCare. All rights reserved.</p>
        <p className="site-footer-made-by">Built for OLFU IT Students</p>
      </div>
    </footer>
  );
}
