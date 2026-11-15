import { useId } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui";
import useHashScroll from "@/shared/hooks/useHashScroll";
import { useAuth } from "@/pages/authentication/AuthContext";
import { SUPPORT_EMAILS } from "@/pages/legal/legalContent";
import { BANDS, BAND_LABEL, PSS_VALID_DAYS, WHO_VALID_DAYS } from "@/utils/workload";
import { WORKLOAD_NOTE } from "@/utils/weekReading";
import usePageTitle from "@/app/usePageTitle";
import "./about.css";

const WHAT_IT_DOES = [
  ["Plan your week", "See your classes, tasks and exams in one place, and which day is heaviest."],
  ["Check in on how you feel", "Short questionnaires you can repeat, with a simple result and what to try next."],
  ["Study with less stress", "Reviewers and flashcards from your own notes, with practice that remembers what you missed."],
];

// "0 to 30", "31 to 60", ... worked out from BANDS so the page can never disagree with the score.
const BAND_ROWS = BANDS.map(({ max, name }, i) => ({
  name,
  range: `${i === 0 ? 0 : BANDS[i - 1].max + 1} to ${max}`,
}));

// What each address is for, in the order of SUPPORT_EMAILS (same wording as Settings > Help).
const EMAIL_HINTS = ["Questions about the app", "Report a problem"];

function Row({ label, hint, children }) {
  return (
    <div className="about-row">
      <span className="about-row__label">{label}</span>
      {hint && <span className="about-row__hint">{hint}</span>}
      {children}
    </div>
  );
}

function Group({ title, id, children }) {
  const titleId = useId();
  return (
    <section className="about-group" id={id} aria-labelledby={titleId}>
      <h2 id={titleId} className="about-group__title">{title}</h2>
      {children}
    </section>
  );
}

// About (Figma 298:18282 desktop, 298:18387 phone, 298:18491 signed in): what the app does, where the numbers
// come from, who made it and how to reach them. Every number and name is read from the code that uses it.
export default function AboutPage() {
  const { isLoggedin } = useAuth();
  usePageTitle("About");
  useHashScroll();

  return (
    <article className={`about${isLoggedin ? " about--app" : ""}`}>
      <Button to={isLoggedin ? "/home" : "/"} variant="ghost" size="sm" icon={ArrowLeft} className="about__back">
        {isLoggedin ? "Back to Home" : "Back to sign in"}
      </Button>

      <header className="about__head">
        <h1>About StressCare</h1>
        <p>
          A stress management app for college students. It shows how heavy your week is, helps you check in on
          how you feel, and plans around both.
        </p>
      </header>

      <div className="about__groups stagger">
        <Group title="What it does">
          {WHAT_IT_DOES.map(([label, hint]) => <Row key={label} label={label} hint={hint} />)}
        </Group>

        <Group title="How the numbers work">
          <Row label="PSS-10" hint="Perceived Stress Scale. Cohen, Kamarck and Mermelstein, 1983." />
          <Row label="WHO-5" hint="Well-Being Index. World Health Organization, 1998." />
          <Row
            label="How long a check-in counts"
            hint={`A stress check-in counts for ${PSS_VALID_DAYS} days and a well-being check-in for ${WHO_VALID_DAYS}. After that it stops affecting your plan until you take it again.`}
          />
          <Row
            label="Not a diagnosis"
            hint="Your scores help StressCare adjust your plan and suggest changes. They are never a medical result."
          />
        </Group>

        <Group title="How full your week is">
          {BAND_ROWS.map(({ name, range }) => (
            <Row key={name} label={BAND_LABEL[name]} hint={`Workload ${range} out of 100.`} />
          ))}
          <Row label="An estimate" hint={WORKLOAD_NOTE} />
        </Group>

        <Group title="The team">
          <Row label={<span className="about-placeholder">[team member names]</span>} hint="Placeholder until the team adds their names." />
          <Row label="Made at OLFU" hint="A thesis project by IT students." />
        </Group>

        <Group title="Contact us" id="contact">
          {SUPPORT_EMAILS.map((email, i) => (
            <Row key={email} label={EMAIL_HINTS[i]}>
              <a className="about-row__mail" href={`mailto:${email}`}>{email}</a>
            </Row>
          ))}
        </Group>
      </div>

      <nav className="about__links" aria-label="Legal">
        <Button to="/terms-of-service" variant="ghost" state={{ from: "/about" }}>Terms</Button>
        <Button to="/privacy-policy" variant="ghost" state={{ from: "/about" }}>Privacy</Button>
      </nav>
    </article>
  );
}
