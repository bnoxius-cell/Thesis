import { Link } from "react-router-dom";
import Logo from "@/assets/logo.png";
import PageArrival from "./PageArrival";
import "./layout.css";
import "./public.css";

// Pages anyone can open, signed in or not (legal text, About, 404): the logo, then a 720px column.
export default function PublicLayout() {
  return (
    <div className="shell-public">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="shell-public__bar">
        <Link to="/" className="shell-public__logo" aria-label="StressCare home">
          <img src={Logo} alt="" width="32" height="32" />
          <span aria-hidden="true">Stress<span className="shell-public__logo-accent">Care</span></span>
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="shell-main shell-public__main">
        <PageArrival />
      </main>
    </div>
  );
}
