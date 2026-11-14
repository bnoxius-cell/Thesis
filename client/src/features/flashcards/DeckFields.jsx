import { Field, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import NewSubjectNameField from "@/features/study/NewSubjectNameField";
import newSubjectOption from "@/features/study/newSubjectOption";
import { NEW_SUBJECT } from "@/features/study/subjectForm";

const NEW_SUBJECT_OPTION = newSubjectOption("New subject...");

// The fields of a deck of your own (Figma 261:993): a title and an optional subject. The Write my own side of
// the Make flashcards dialog and Edit deck use them. The subject ends with "New subject...", which opens a
// required name (`subject` is then NEW_SUBJECT and the name is `newSubjectName`).
export default function DeckFields({
  title, onTitle, subject, onSubject, subjects, titleError, maxTitle, disabled,
  newSubjectName, onNewSubjectName, newSubjectError,
}) {
  const phone = useMediaQuery("(max-width: 720px)");
  const options = [
    { value: "", label: "No subject" },
    ...subjects.map((item) => ({ value: item._id, label: item.name })),
    NEW_SUBJECT_OPTION,
  ];

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
      {subject === NEW_SUBJECT && (
        <NewSubjectNameField
          value={newSubjectName}
          onChange={(event) => onNewSubjectName(event.target.value)}
          error={newSubjectError}
          disabled={disabled}
        />
      )}
    </>
  );
}
