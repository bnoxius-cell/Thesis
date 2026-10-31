import { useEffect, useRef } from "react";
import { Button, ProgressBar } from "@/shared/ui";
import { selectOnArrowKey } from "@/shared/ui/rovingKeys";
import PracticeAnswer from "./PracticeAnswer";
import PracticeFeedback from "./PracticeFeedback";

function answerState(i, picked, result) {
  if (!result) return picked === i ? "selected" : "idle";
  if (i === result.correctIndex) return "correct";
  return i === result.choice ? "yours" : "idle";
}

// One question (Figma 76:840), and the same screen once it is graded (77:452): the right answer in
// good, a wrong pick in watch, a Why card, and Next. The question is the page heading and names the
// radiogroup. Arrows choose, Enter checks, and focus starts on the answers (or on Next after grading).
export default function PracticeQuestion({ run }) {
  const { question, index, total, picked, setPicked, result, busy, isLast, check, next } = run;
  const group = useRef(null);
  const nextButton = useRef(null);
  const chosen = result ? result.choice : picked;
  const tabStop = Math.max(chosen ?? 0, 0);

  useEffect(() => {
    group.current?.querySelector('[tabindex="0"]')?.focus({ preventScroll: true });
  }, [question._id]);
  useEffect(() => {
    if (result) nextButton.current?.focus({ preventScroll: true });
  }, [result]);

  const onKeyDown = (event) => {
    if (result) return;
    if (event.key === "Enter") {
      event.preventDefault(); // the focused row would otherwise just pick itself again
      check();
      return;
    }
    selectOnArrowKey(event, '[role="radio"]');
  };

  return (
    <div className="practice-column">
      <div className="practice-progress">
        <p className="practice-progress__text">Question {index + 1} of {total}</p>
        <ProgressBar
          className="practice-progress__bar"
          value={(index + 1) / total}
          label="Practice progress"
          valueText={`Question ${index + 1} of ${total}`}
        />
      </div>
      {/* Only this part is keyed, so the progress bar keeps its fill and eases to the next value. */}
      <div key={question._id} className="practice-column practice-column--enter">
        <h1 id="practice-question" className="practice-title">{question.prompt}</h1>
        <div
          ref={group}
          role="radiogroup"
          aria-labelledby="practice-question"
          className="practice-answers"
          onKeyDown={onKeyDown}
        >
          {question.options.map((option, i) => (
            <PracticeAnswer
              key={i}
              label={option}
              state={answerState(i, picked, result)}
              checked={chosen === i}
              focusable={i === tabStop}
              locked={Boolean(result)}
              onPick={() => setPicked(i)}
            />
          ))}
        </div>
        {result && <PracticeFeedback question={question} result={result} />}
        <div className="practice-nav">
          {result ? (
            <Button ref={nextButton} busy={busy} onClick={next}>
              {isLast ? "See results" : "Next question"}
            </Button>
          ) : (
            <Button busy={busy} disabled={picked === null} onClick={check}>Check answer</Button>
          )}
        </div>
      </div>
    </div>
  );
}
