import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Field, Modal, Segment, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import SourceDropZone from "./SourceDropZone";
import StoredFilesPicker from "./StoredFilesPicker";
import useCreateReviewer from "./useCreateReviewer";
import useSubjectSources from "./useSubjectSources";
import {
  DEFAULT_QUESTION_COUNT,
  DEFAULT_QUESTION_TYPE,
  NEW_SUBJECT,
  clampCount,
  countOptionsFor,
  limitMessage,
  problemsMessage,
  questionTypeOptions,
  takeSources,
} from "./reviewerForm";
import { SUBJECT_LIMITS, subjectNameError } from "./subjectForm";
import "./study-dialog.css";

const countOptions = (type) => countOptionsFor(type).map((n) => ({ value: n, label: String(n) }));
const TYPE_OPTIONS = questionTypeOptions();
const ESSAY_HELPER = "Essay sets have 10 or 15 questions. Each answer uses 1 of your 40 checks a day.";
const SOURCE_TABS = [
  { value: "upload", label: "Upload a file" },
  { value: "stored", label: "Subject files" },
];
const NEW_SUBJECT_OPTION = { value: NEW_SUBJECT, label: "Create new subject", leading: <Plus size={18} aria-hidden="true" /> };

// New reviewer (Figma 78:1272). Title and Subject can stay as they are: a blank title is named from
// the files and "No subject" files it nowhere. Pasting notes has no backend, so it isn't offered. Question type
// is the server's `questionType` (Figma QT-F1 to F4): the hint of the chosen type shows under the
// control, and essay (when offered) limits the counts to 10 and 15. The server reads the files and writes the reviewer in the background, so the
// dialog closes as soon as the upload lands (onCreated) and the row shows up as processing.
// Source is one of two things, never both: files uploaded here (PDF, Word, PowerPoint or photos, up to
// 10), or, when the chosen subject has usable stored files, some of those ("Subject files").
// `limits` is { dailyLimit, usedToday, enabled } from the list: at the limit, Create is off and
// the dialog says why. `defaultSubject` is a subject id to start on (the Subject page). The Subject
// dropdown ends with "Create new subject" unless `allowNewSubject` is off (the Subject page); the
// subject is then made together with the reviewer and `onSubjectCreated` tells the page to list it.
export default function NewReviewerDialog({
  subjects,
  defaultSubject = "",
  allowNewSubject = true,
  limits,
  onClose,
  onCreated,
  onSubjectCreated,
}) {
  const [entries, setEntries] = useState([]); // uploaded files: [{ id, file }]
  const [storedIds, setStoredIds] = useState([]);
  const [tab, setTab] = useState("upload");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");
  const [count, setCount] = useState(DEFAULT_QUESTION_COUNT);
  const [questionType, setQuestionType] = useState(DEFAULT_QUESTION_TYPE);
  const [pickError, setPickError] = useState("");
  const { create, creating, error, clearError } = useCreateReviewer({ onSubjectCreated });
  const phone = useMediaQuery("(max-width: 720px)");
  const blocked = limitMessage(limits);
  const message = blocked || pickError || error;

  const chosen = subjects.find((s) => s._id === subject);
  const storedFiles = useSubjectSources(chosen?._id ?? "", Boolean(chosen?.archivedAt));
  const source = storedFiles.length > 0 && tab === "stored" ? "stored" : "upload";
  const creatingSubject = subject === NEW_SUBJECT;
  const chosenType = TYPE_OPTIONS.find((option) => option.value === questionType);

  const subjectOptions = [
    { value: "", label: "No subject" },
    ...subjects.map((s) => ({ value: s._id, label: s.name })),
    ...(allowNewSubject ? [NEW_SUBJECT_OPTION] : []),
  ];

  // Another subject has other files, and "Create new subject" or "No subject" has none.
  const chooseSubject = (value) => {
    setSubject(value);
    setStoredIds([]);
    setTab("upload");
    setNameError("");
    setPickError("");
    clearError();
  };

  const chooseType = (value) => {
    setQuestionType(value);
    setCount((current) => clampCount(value, current));
  };

  const addFiles = (picked) => {
    clearError();
    const { entries: next, problems } = takeSources(entries, picked);
    setEntries(next);
    setPickError(problemsMessage(problems));
  };
  const removeFile = (id) => {
    setPickError("");
    setEntries((current) => current.filter((entry) => entry.id !== id));
  };
  const toggleStored = (id) => {
    clearError();
    setStoredIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };
  const chooseTab = (value) => {
    setTab(value);
    setPickError("");
    clearError();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (blocked || creating) return;
    const problem = creatingSubject ? subjectNameError({ name: newName }) : "";
    setNameError(problem);
    if (problem) return;
    const picked = source === "stored" ? storedIds.length : entries.length;
    if (!picked) return setPickError(source === "stored" ? "Tick a file first." : "Add a file first.");
    const made = await create({
      kind: source,
      files: entries.map((entry) => entry.file),
      fileIds: storedIds,
      title,
      subject: creatingSubject ? "" : subject,
      newSubjectName: creatingSubject ? newName : undefined,
      count,
      questionType,
    });
    if (made) onCreated();
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
      confirmClose={() => Boolean(entries.length || storedIds.length || title.trim() || newName.trim())}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={creating}>Cancel</Button>
          <Button type="submit" busy={creating} disabled={Boolean(blocked)}>
            {creating ? "Reading your files" : "Create reviewer"}
          </Button>
        </>
      )}
    >
      <Field
        label="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Leave it blank and we'll name it"
        maxLength={120}
        autoComplete="off"
        disabled={creating}
      />
      <Field label="Subject">
        {(wiring) => (
          <SelectButton
            {...wiring}
            block
            native={phone}
            options={subjectOptions}
            value={subject}
            onChange={chooseSubject}
            disabled={creating}
            label="Subject"
          />
        )}
      </Field>
      {creatingSubject && (
        <Field
          className="is-entering"
          label="Subject name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          error={nameError}
          maxLength={SUBJECT_LIMITS.name}
          autoComplete="off"
          autoFocus
          disabled={creating}
        />
      )}
      <div className="ui-field" role="group" aria-labelledby="reviewer-source-label">
        <span id="reviewer-source-label" className="ui-field__label">Source</span>
        {storedFiles.length > 0 && (
          <Segment label="Source" options={SOURCE_TABS} value={source} onChange={chooseTab} disabled={creating} />
        )}
        <div key={source} className={storedFiles.length > 0 ? "tab-panel-in" : undefined}>
          {source === "stored" ? (
            <StoredFilesPicker
              files={storedFiles}
              pickedIds={storedIds}
              onToggle={toggleStored}
              disabled={creating}
              describedBy="reviewer-note"
            />
          ) : (
            <SourceDropZone entries={entries} onAdd={addFiles} onRemove={removeFile} disabled={creating} describedBy="reviewer-note" />
          )}
        </div>
      </div>
      <Field label="Question type" hint={chosenType?.hint}>
        {(wiring) => (
          <SelectButton
            {...wiring}
            block
            native={phone}
            options={TYPE_OPTIONS}
            value={questionType}
            onChange={chooseType}
            disabled={creating}
            label="Question type"
          />
        )}
      </Field>
      <Field label="Questions" hint={questionType === "essay" ? ESSAY_HELPER : undefined}>
        {({ labelId }) => (
          <Segment labelId={labelId} options={countOptions(questionType)} value={count} onChange={setCount} disabled={creating} />
        )}
      </Field>
      {message && <p id="reviewer-note" className="study-dialog__error" role="alert">{message}</p>}
    </Modal>
  );
}
