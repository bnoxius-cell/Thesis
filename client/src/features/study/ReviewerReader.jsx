import { Card } from "@/shared/ui";

const paragraphs = (text) => (text ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

// A titled block of the notes. Nothing renders when there is nothing in it.
function Section({ title, empty, children }) {
  if (empty) return null;
  return (
    <section className="reviewer-section">
      <h2 className="reviewer-section__title">{title}</h2>
      {children}
    </section>
  );
}

// The notes the AI wrote from the files (Figma 76:1280): what it covers, key points, key terms and
// how it breaks down by topic. Long text wraps instead of stretching the card.
export default function ReviewerReader({ reviewer }) {
  const summary = paragraphs(reviewer.summary);
  const keyPoints = reviewer.keyPoints ?? [];
  const keyTerms = reviewer.keyTerms ?? [];
  const topics = reviewer.topics ?? [];

  return (
    <Card as="article" className="reviewer-reader" aria-label="Reviewer notes">
      <Section title="What this covers" empty={summary.length === 0}>
        {summary.map((text) => <p key={text} className="reviewer-text">{text}</p>)}
      </Section>
      <Section title="Remember these" empty={keyPoints.length === 0}>
        <ul className="reviewer-points">
          {keyPoints.map((point) => <li key={point} className="reviewer-text">{point}</li>)}
        </ul>
      </Section>
      <Section title="Terms to know" empty={keyTerms.length === 0}>
        <dl className="reviewer-terms">
          {keyTerms.map(({ term, definition }) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd className="reviewer-text">{definition}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="How it breaks down" empty={topics.length === 0}>
        <dl className="reviewer-terms">
          {topics.map(({ name, summary: about }) => (
            <div key={name}>
              <dt>{name}</dt>
              {about && <dd className="reviewer-text">{about}</dd>}
            </div>
          ))}
        </dl>
      </Section>
    </Card>
  );
}
