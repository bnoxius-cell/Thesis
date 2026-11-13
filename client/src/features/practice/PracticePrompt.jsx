// A fill in the blank's blank: a run of underscores in the prompt.
const BLANK = /_{3,}/;

// The question as the page heading (it also names the answers). A fill in the blank draws its blank
// as a line in the sentence (Figma QT-F7), read out as "blank", and shows the answer in it once graded.
export default function PracticePrompt({ question, result }) {
  const [before, ...rest] = question.prompt.split(BLANK);
  const hasBlank = question.type === "fill" && rest.length > 0;
  return (
    <h1 id="practice-question" className="practice-title">
      {hasBlank ? (
        <>
          {before}
          {result ? (
            <span className="practice-blank practice-blank--filled">{result.answer}</span>
          ) : (
            <span className="practice-blank"><span className="sr-only">blank</span></span>
          )}
          {rest.join(" ")}
        </>
      ) : (
        question.prompt
      )}
    </h1>
  );
}
