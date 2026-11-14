import { Field, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";

// The two fields of a deck of your own (Figma 261:993): a title and an optional subject. The Write my own
// side of the Make flashcards dialog uses them.
export default function DeckFields({ title, onTitle, subject, onSubject, subjects, titleError, maxTitle, disabled }) {
  const phone = useMediaQuery("(max-width: 720px)");
  const options = [{ value: "", label: "No subject" }, ...subjects.map((item) => ({ value: item._id, label: item.name }))];

  return (
    <>
      <Field
        label="Title"
        value={title}
        onChange={(event) => onTitle(event.target.value)}
        placeholder="Name your deck"
        error={titleError}
        maxLength={maxTitle}
        autoComplete="off"
        autoFocus
        disabled={disabled}
      />
      <Field label="Subject">
        {(wiring) => (
          <SelectButton {...wiring} block native={phone} options={options} value={subject} placeholder="Choose a subject" onChange={onSubject} disabled={disabled} label="Subject" />
        )}
      </Field>
    </>
  );
}
