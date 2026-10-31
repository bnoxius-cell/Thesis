import { useState } from "react";
import { Button, Field, Modal, Segment, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import PdfDropZone from "./PdfDropZone";
import useCreateReviewer from "./useCreateReviewer";
import { DEFAULT_QUESTION_COUNT, QUESTION_COUNTS, limitMessage, pdfProblem } from "./reviewerForm";
import "./study-dialog.css";

const COUNT_OPTIONS = QUESTION_COUNTS.map((n) => ({ value: n, label: String(n) }));

// New reviewer (Figma 78:1272). Title and Subject are optional: a blank title is named from the PDF
// and "No subject" files it nowhere. Pasting notes and question types have no backend, so they
// aren't offered. The server reads the PDF and writes the reviewer in the background, so the
// dialog closes as soon as the upload lands (onCreated) and the row shows up as processing.
// `limits` is { dailyLimit, usedToday, enabled } from the list: at the limit, Create is off and
// the dialog says why.
export default function NewReviewerDialog({ subjects, limits, onClose, onCreated }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [count, setCount] = useState(DEFAULT_QUESTION_COUNT);
  const [pickError, setPickError] = useState("");
  const { create, creating, error, clearError } = useCreateReviewer();
  const phone = useMediaQuery("(max-width: 720px)");
  const blocked = limitMessage(limits);
  const message = blocked || pickError || error;

  const subjectOptions = [
    { value: "", label: "No subject" },
    ...subjects.map((s) => ({ value: s._id, label: s.name })),
  ];

  const pick = (picked) => {
    clearError();
    const problem = pdfProblem(picked);
    setPickError(problem);
    if (!problem) setFile(picked);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (blocked || creating) return;
    if (!file) return setPickError("Choose a PDF first.");
    if (await create({ file, title, subject, count })) onCreated();
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      className="study-dialog"
      title="New reviewer"
      subtitle="Add notes and get questions to practise."
      busy={creating}
      onClose={onClose}
      confirmClose={() => Boolean(file || title.trim())}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={creating}>Cancel</Button>
          <Button type="submit" busy={creating} disabled={Boolean(blocked)}>
            {creating ? "Reading your PDF" : "Create reviewer"}
          </Button>
        </>
      }
    >
      <Field
        label="Title (optional)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Leave it blank and we'll name it"
        maxLength={120}
        autoComplete="off"
        disabled={creating}
      />
      <Field label="Subject (optional)">
        {(wiring) => (
          <SelectButton
            {...wiring}
            block
            native={phone}
            options={subjectOptions}
            value={subject}
            onChange={setSubject}
            disabled={creating}
            label="Subject"
          />
        )}
      </Field>
      <div className="ui-field">
        <span className="ui-field__label">Source</span>
        <PdfDropZone file={file} onPick={pick} disabled={creating} describedBy="reviewer-note" />
      </div>
      <Field label="Questions">
        {({ labelId }) => (
          <Segment labelId={labelId} options={COUNT_OPTIONS} value={count} onChange={setCount} disabled={creating} />
        )}
      </Field>
      <p className="study-dialog__note">
        The text of your PDF goes to Google's Gemini AI to write the reviewer, so leave out anything personal.
        AI can get things wrong, so check anything that looks off against your notes.
      </p>
      {message && <p id="reviewer-note" className="study-dialog__error" role="alert">{message}</p>}
    </Modal>
  );
}
