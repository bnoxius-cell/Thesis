import { Link } from 'react-router-dom';
import Logo from '../../assets/logo.png';
import { useAuth } from '../../pages/authentication/AuthContext';

// One rule: signed in = the one-line app footer, on every page. Signed out = a compact public footer
// (logo, About, Privacy, Terms, Contact). No links into signed-in pages and no email addresses here:
// contact details live on About > Contact and in the legal pages.
export default function Footer() {
  const { isLoggedin, user } = useAuth();
  const year = new Date().getFullYear();

  if (isLoggedin) {
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
      <Link to="/" className="logo-link" aria-label="StressCare, go to sign in">
        <img src={Logo} alt="" className="logo-svg" />
        <span className="logo-text">Stress<span>Care</span></span>
      </Link>
      <nav aria-label="Footer">
        <Link to="/about">About</Link>
        <Link to="/privacy-policy">Privacy</Link>
        <Link to="/terms-of-service">Terms</Link>
        <Link to="/about#contact">Contact</Link>
      </nav>
      <span>&copy; {year} StressCare</span>
    </footer>
  );
}
