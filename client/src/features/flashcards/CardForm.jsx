import { Field } from "@/shared/ui";

// The two fields of a card (Figma 260:892, 261:1801): the Term on one line and the Answer in a textarea. Put
// them inside a <form>. Enter in the Term moves to the Answer instead of submitting; Enter in the Answer is a
// new line; Ctrl or Cmd + Enter submits. `termRef` lets the page put focus back on the Term after an add.
export default function CardForm({ term, answer, onChange, termRef, disabled, autoFocus }) {
  const answerKeys = (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };
  const termKeys = (event) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.elements.answer.focus();
  };

  return (
    <>
      <Field
        label="Term"
        name="term"
        ref={termRef}
        value={term}
        onChange={(event) => onChange({ term: event.target.value })}
        onKeyDown={termKeys}
        placeholder="The word or question"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
      />
      <Field
        label="Answer"
        name="answer"
        multiline
        value={answer}
        onChange={(event) => onChange({ answer: event.target.value })}
        onKeyDown={answerKeys}
        placeholder="What you want to remember"
        disabled={disabled}
      />
    </>
  );
}
