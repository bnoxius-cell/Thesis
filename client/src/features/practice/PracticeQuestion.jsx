import { useEffect, useRef } from "react";
import { Button, Chip, ProgressBar } from "@/shared/ui";
import { selectOnArrowKey } from "@/shared/ui/rovingKeys";
import { questionKind } from "./answerDraft";
import PracticeAnswer from "./PracticeAnswer";
import PracticeFeedback from "./PracticeFeedback";
import PracticeListAnswer from "./PracticeListAnswer";
import PracticePrompt from "./PracticePrompt";
import PracticeTypedAnswer from "./PracticeTypedAnswer";

const TYPE_LABELS = { tf: "True or false", id: "Identification", fill: "Fill in the blank", enum: "Enumeration" };
// The key that picks each true or false row.
const TF_KEYS = ["T", "F"];

function answerState(i, picked, result) {
  if (!result) return picked === i ? "selected" : "idle";
  if (i === result.correctIndex) return "correct";
  return i === result.choice ? "yours" : "idle";
}

// One question (Figma 76:840 and QT-F5 to F8), and the same screen once it is graded (77:452): the
// right answer in good, a wrong one in watch, a Why card, and Next. The question is the page heading.
// Multiple choice and true or false are a radiogroup (arrows choose, T and F pick a true or false row,
// Enter checks); identification, fill in the blank and enumeration are typed. Focus starts on the
// answers (or on Next after grading).
export default function PracticeQuestion({ run }) {
  const { question, index, total, draft, setDraft, canCheck, result, busy, isLast, check, next } = run;
  const kind = questionKind(question);
  const typed = kind === "id" || kind === "fill" || kind === "enum";
  const group = useRef(null);
  const nextButton = useRef(null);
  const chosen = result ? result.choice : draft;
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
    const key = TF_KEYS.indexOf(event.key.toUpperCase());
    if (kind === "tf" && key >= 0 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      setDraft(key);
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
        <div className="practice-ask">
          {TYPE_LABELS[kind] && <Chip tone="neutral" className="practice-ask__type">{TYPE_LABELS[kind]}</Chip>}
          <PracticePrompt question={question} result={result} />
          {kind === "enum" && <p className="practice-hint">{question.count} items. The order doesn't matter.</p>}
        </div>
        {(kind === "mc" || kind === "tf") && (
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
                state={answerState(i, draft, result)}
                checked={chosen === i}
                focusable={i === tabStop}
                locked={Boolean(result)}
                shortcut={kind === "tf" ? TF_KEYS[i] : undefined}
                onPick={() => setDraft(i)}
              />
            ))}
          </div>
        )}
        {(kind === "id" || kind === "fill") && (
          <PracticeTypedAnswer value={draft} onChange={setDraft} onSubmit={check} result={result} />
        )}
        {kind === "enum" && (
          <PracticeListAnswer
            values={draft}
            onChange={(i, value) => setDraft((boxes) => boxes.map((box, at) => (at === i ? value : box)))}
            onSubmit={check}
            result={result}
          />
        )}
        {result && <PracticeFeedback question={question} result={result} />}
        <div className={`practice-nav ${typed ? "practice-nav--typed" : ""}`.trim()}>
          {result ? (
            <Button ref={nextButton} busy={busy} onClick={next}>
              {isLast ? "See results" : "Next question"}
            </Button>
          ) : (
            <Button busy={busy} disabled={!canCheck} onClick={check}>Check answer</Button>
          )}
        </div>
      </div>
    </div>
  );
}
