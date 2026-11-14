import { Button, Card, ProgressBar } from "@/shared/ui";
import ReviewerFlashcardsCard from "@/features/flashcards/ReviewerFlashcardsCard";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The one sentence under "Learning Mode": where the open session stands, else the last score,
// else what Learning Mode is.
function statusLine(reviewer, openSession, progress) {
  if (openSession) {
    const left = openSession.total - openSession.answered;
    const done = Math.round((openSession.answered / openSession.total) * 100);
    return `${done}% done · ${plural(left, "question")} left`;
  }
  if (progress?.sessions) {
    return `Last score ${Math.round(progress.lastScore)}% · best ${Math.round(progress.bestScore)}% · ${plural(progress.sessions, "session")}`;
  }
  const questions = plural(reviewer.questionCount, "question");
  if (reviewer.questionType === "essay") return `${questions}, one at a time. The AI checks each answer.`;
  return `${questions}, one at a time. You'll see why after each answer.`;
}

// The right-hand column (Figma 76:1287): Learning Mode progress with Resume when a session under
// 24 hours is open, the topics that still need work with a way to practise just those, and the Flashcards card.
// `links` holds the router props (to, state) for Resume and for "Practise these".
export default function ReviewerSidePanel({ reviewer, openSession, progress, links }) {
  const weakTopics = progress?.weakTopics ?? [];

  return (
    <aside className="reviewer-side" aria-label="Learning Mode">
      <Card as="section" className="reviewer-card" aria-labelledby="reviewer-learning-title">
        <h2 id="reviewer-learning-title" className="reviewer-card__title">Learning Mode</h2>
        <p className="reviewer-card__line">{statusLine(reviewer, openSession, progress)}</p>
        {openSession && (
          <>
            <ProgressBar
              value={openSession.answered / openSession.total}
              label="Learning Mode progress"
              valueText={`${openSession.answered} of ${openSession.total} questions answered`}
            />
            <Button className="reviewer-card__action" {...links.resume}>Resume</Button>
          </>
        )}
      </Card>
      <ReviewerFlashcardsCard reviewerId={reviewer._id} terms={reviewer.keyTerms?.length ?? 0} />
      {weakTopics.length > 0 && (
        <Card as="section" className="reviewer-card" aria-labelledby="reviewer-weak-title">
          <h2 id="reviewer-weak-title" className="reviewer-card__title">Worth another go</h2>
          <ul className="reviewer-weak">
            {weakTopics.map((name) => <li key={name} className="reviewer-card__line">{name}</li>)}
          </ul>
          <Button variant="secondary" className="reviewer-card__action" {...links.weak}>Practise these</Button>
        </Card>
      )}
    </aside>
  );
}
