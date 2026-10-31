import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { daysAgoText } from "@/shared/lib/dates";

const MAX_ROWS = 3;

const metaFor = (reviewer) =>
  ["Reviewer", reviewer.course, `added ${daysAgoText(reviewer.generatedAt || reviewer.createdAt).toLowerCase()}`]
    .filter(Boolean)
    .join(" · ");

// "Pick up where you left off" (Figma 72:305, 75:969): the most recent reviewers that are ready to
// open, up to three. Nothing renders when there are none. The list doesn't say which reviewers have a
// Learning Mode session open, so this is recency only; notes have no backend yet.
export default function PickUpHero({ reviewers }) {
  const ready = (reviewers ?? []).filter((r) => r.status === "ready").slice(0, MAX_ROWS);
  if (ready.length === 0) return null;

  return (
    <section className="study-hero" aria-labelledby="study-hero-title">
      <h2 id="study-hero-title" className="study-hero__title">Pick up where you left off</h2>
      <ul className="study-hero__rows">
        {ready.map((reviewer) => (
          <li key={reviewer._id}>
            <Link to={`/study/reviewers/${reviewer._id}`} className="study-row">
              <span className="study-row__icon" aria-hidden="true"><FileText size={20} /></span>
              <span className="study-row__text">
                <strong className="study-row__title">{reviewer.title}</strong>
                <span className="study-row__meta">{metaFor(reviewer)}</span>
              </span>
              <span className="study-row__open" aria-hidden="true">Open</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
