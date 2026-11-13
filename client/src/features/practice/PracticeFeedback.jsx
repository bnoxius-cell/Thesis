import { missedItems, scoreLine } from "./PracticeListAnswer";

// The line a screen reader hears when an answer is graded: the colours and tags don't announce themselves.
function spokenLine(question, result) {
  switch (question.type ?? "mc") {
    case "id":
    case "fill":
      return result.correct ? "Correct." : `Not quite. The answer is ${result.answer}.`;
    case "enum":
      return result.correct
        ? `${result.got} of ${result.of}. Correct.`
        : `${scoreLine(result)} You missed: ${missedItems(result).join(", ")}.`;
    default:
      return result.correct ? "Correct." : `Not quite. The correct answer is ${question.options[result.correctIndex]}.`;
  }
}

// What the server said about the answer just given (Figma 77:489): the Why card, plus the spoken line.
export default function PracticeFeedback({ question, result }) {
  return (
    <>
      <p className="sr-only" role="status">{spokenLine(question, result)}</p>
      {result.explanation && (
        <section className="practice-why" aria-labelledby="practice-why-title">
          <h2 id="practice-why-title" className="practice-eyebrow">Why</h2>
          <p className="practice-why__text">{result.explanation}</p>
        </section>
      )}
    </>
  );
}
