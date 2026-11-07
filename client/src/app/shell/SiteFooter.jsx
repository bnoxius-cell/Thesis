import { Link } from "react-router-dom";
import { useBottomBarHidden } from "./focusView";
import "./site-footer.css";

const LINKS = [
  { label: "Terms", to: "/terms-of-service" },
  { label: "Privacy", to: "/privacy-policy" },
  { label: "About", to: "/about" },
  { label: "Help", to: "/me/help" },
];

// The quiet row at the foot of every signed-in page (Figma 164:3243, 164:3376): the name on the left
// and four links on the right, or on a phone four equal links. It sits in <main>, so the phone's
// bottom bar room is already left below it. A screen that takes the whole phone height (the chat)
// asks for the focus view, and the footer steps aside with the bar.
export default function SiteFooter() {
  if (useBottomBarHidden()) return null;
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <span className="site-footer__name">StressCare</span>
        <nav aria-label="About StressCare">
          <ul className="site-footer__links">
            {LINKS.map(({ label, to }) => (
              <li key={to}>
                <Link to={to}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
