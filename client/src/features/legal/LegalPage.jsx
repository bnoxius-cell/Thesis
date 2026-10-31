import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import { TERMS, PRIVACY, LEGAL_UPDATED, SUPPORT_EMAILS } from "@/pages/legal/legalContent";
import usePageTitle from "@/app/usePageTitle";
import "./legal.css";

const DOCS = {
  terms: { doc: TERMS, other: { label: "Privacy Policy", path: "/privacy-policy" } },
  privacy: { doc: PRIVACY, other: { label: "Terms of Service", path: "/terms-of-service" } },
};

function Block({ block }) {
  if (block.p) return <p>{block.p}</p>;
  if (block.ul) return <ul>{block.ul.map((item) => <li key={item}>{item}</li>)}</ul>;
  if (block.mail) {
    return (
      <p>
        {block.mail}{" "}
        {SUPPORT_EMAILS.map((email, i) => (
          <span key={email}>{i > 0 && " or "}<a href={`mailto:${email}`}>{email}</a></span>
        ))}.
      </p>
    );
  }
  return null;
}

// The Terms of Service or Privacy Policy text (`kind` is "terms" or "privacy"), readable signed in or out.
export default function LegalPage({ kind }) {
  const { isLoggedin } = useAuth();
  const location = useLocation();
  const { doc, other } = DOCS[kind];
  // Opened from the sign-up form or the consent prompt, the back link returns there.
  const backTo = location.state?.from || (isLoggedin ? "/home" : "/");
  usePageTitle(doc.title);

  return (
    <article className="legal">
      <Button to={backTo} variant="ghost" size="sm" icon={ArrowLeft} className="legal__back">
        {isLoggedin ? "Back" : "Back to sign in"}
      </Button>

      <header className="legal__head">
        <h1>{doc.title}</h1>
        <p className="legal__updated">Last updated {LEGAL_UPDATED}</p>
        <p>{doc.intro}</p>
      </header>

      {doc.sections.map((section) => (
        <section key={section.id} id={section.id}>
          <h2>{section.title}</h2>
          {section.blocks.map((block, i) => <Block key={i} block={block} />)}
        </section>
      ))}

      <p>
        Also read our <Link to={other.path} state={{ from: backTo }}>{other.label}</Link>.
      </p>
    </article>
  );
}
