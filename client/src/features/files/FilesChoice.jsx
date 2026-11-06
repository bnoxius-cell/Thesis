import { useId } from "react";
import "./files-dialogs.css";

const CHOICES = [
  { value: "keep", title: "Keep the files", note: "They move to General." },
  { value: "delete", title: "Delete the files too", note: "They are removed for good. This can't be undone." },
];

// What happens to the files of a folder or subject being deleted (Figma 162:3111, 162:3461): `intro`
// says how many there are, then two radio cards, "keep" (they move to General) or "delete". `value`
// is the choice and `onChange` gets the new one.
export default function FilesChoice({ intro, value, onChange }) {
  const name = useId();
  return (
    <div className="files-choices">
      <p>{intro}</p>
      <div role="radiogroup" aria-label="What happens to the files" className="files-choices__list">
        {CHOICES.map((choice) => (
          <label key={choice.value} className="files-choice">
            <input type="radio" name={name} checked={value === choice.value} onChange={() => onChange(choice.value)} />
            <span className="files-choice__text">
              <strong>{choice.title}</strong>
              <span>{choice.note}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
