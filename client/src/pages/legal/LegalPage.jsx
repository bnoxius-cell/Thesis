import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { useAuth } from "../authentication/AuthContext";
import { TERMS, PRIVACY, LEGAL_UPDATED, SUPPORT_EMAILS } from "./legalContent";
import "../../App.css";

const DOCS = {
  terms: { doc: TERMS, path: "/terms-of-service", other: { label: "Privacy Policy", path: "/privacy-policy" } },
  privacy: { doc: PRIVACY, path: "/privacy-policy", other: { label: "Terms of Service", path: "/terms-of-service" } },
};

function Block({ block }) {
  if (block.p) return <p>{block.p}</p>;
  if (block.ul) return <ul>{block.ul.map((item) => <li key={item}>{item}</li>)}</ul>;
  if (block.mail) {
    return <p>{block.mail}{" "}{SUPPORT_EMAILS.map((e, i) => (<span key={e}>{i > 0 && " or "}<a href={`mailto:${e}`}>{e}</a></span>))}.</p>;
  }
  return null;
}

// Public page (works signed in or out). `kind` is "terms" or "privacy".
export default function LegalPage({ kind }) {
  const { isLoggedin } = useAuth();
  const location = useLocation();
  const { doc, other } = DOCS[kind];
  // A page opened from the sign-up form or the consent prompt can send people back.
  const backTo = location.state?.from || (isLoggedin ? "/dashboard" : "/");

  return (
    <div className={`app ${isLoggedin ? "app-layout" : "auth-layout"}`}>
      <Header />
      <main className="dashboard legal-page">
        <Link to={backTo} className="legal-back">
          <ArrowLeft size={16} aria-hidden="true" /> {isLoggedin ? "Back" : "Back to sign in"}
        </Link>

        <header className="legal-head">
          <h1>{doc.title}</h1>
          <p className="legal-updated">Last updated {LEGAL_UPDATED}</p>
          <p className="legal-intro">{doc.intro}</p>
        </header>

        <div className="legal-body">
          <nav className="legal-toc" aria-label={`${doc.title} sections`}>
            <ol>
              {doc.sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>
              ))}
            </ol>
          </nav>

          <article className="legal-doc">
            {doc.sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2>{s.title}</h2>
                {s.blocks.map((b, i) => <Block key={i} block={b} />)}
              </section>
            ))}
            <p className="legal-other">
              Also read our <Link to={other.path} state={{ from: backTo }}>{other.label}</Link>.
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
