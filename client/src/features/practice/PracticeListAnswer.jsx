import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import PracticeAnswerNote from "./PracticeAnswerNote";
import "./practice-answers.css";

// "3 of 4." with "Almost." in front when exactly one item is missing.
export const scoreLine = ({ got, of }) => `${got === of - 1 ? "Almost. " : ""}${got} of ${of}.`;

// The items the student didn't give: the key's items that no box matched.
export const missedItems = (result) => result.items.filter((_, index) => !result.matched.includes(index));

// The boxes for an enumeration (Figma QT-F8): one numbered box per item, in any order. Enter moves to the
// next box and checks from the last. Once graded each box is good (it matched an item) or watch, and the
// missed items are listed under them. Never red.
export default function PracticeListAnswer({ values, onChange, onSubmit, result }) {
  const boxes = useRef([]);

  useEffect(() => {
    boxes.current[0]?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (event, index) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (index < values.length - 1) boxes.current[index + 1]?.focus();
    else onSubmit();
  };

  const entries = result ? result.entries : values;
  const missed = result ? missedItems(result) : [];

  return (
    <div className="practice-typed">
      {result && <p className="practice-score">{scoreLine(result)}</p>}
      <ol className="practice-boxes" aria-label="Your answers">
        {entries.map((entry, index) => {
          const hit = result && result.matched[index] >= 0;
          const tone = !result ? "idle" : hit ? "good" : entry ? "watch" : "idle";
          return (
            <li key={index} className="practice-boxes__row">
              <span className="practice-boxes__number" aria-hidden="true">{index + 1}</span>
              <div className={`practice-input practice-input--${tone}`}>
                <input
                  ref={(node) => { boxes.current[index] = node; }}
                  className="practice-input__control"
                  type="text"
                  aria-label={`Item ${index + 1}`}
                  value={entry}
                  onChange={(event) => onChange(index, event.target.value)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  readOnly={Boolean(result)}
                  maxLength={200}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint={index < values.length - 1 ? "next" : "done"}
                />
                {hit && <Check className="practice-input__check" size={20} aria-hidden="true" />}
              </div>
            </li>
          );
        })}
      </ol>
      {missed.length > 0 && <PracticeAnswerNote>Missed: {missed.join(", ")}</PracticeAnswerNote>}
    </div>
  );
}
