// What the server said about the answer just given (Figma 77:489): the Why card, plus a line for
// screen readers, since the colours and tags on the rows don't announce themselves.
export default function PracticeFeedback({ question, result }) {
  const spoken = result.correct
    ? "Correct."
    : `Not quite. The correct answer is ${question.options[result.correctIndex]}.`;
  return (
    <>
      <p className="sr-only" role="status">{spoken}</p>
      {result.explanation && (
        <section className="practice-why" aria-labelledby="practice-why-title">
          <h2 id="practice-why-title" className="practice-eyebrow">Why</h2>
          <p className="practice-why__text">{result.explanation}</p>
        </section>
      )}
    </>
  );
}
