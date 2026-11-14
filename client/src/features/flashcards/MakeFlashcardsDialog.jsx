import { useState } from "react";
import { Button, Chip, Modal, Segment } from "@/shared/ui";
import { useGlobalAdd } from "@/app/shell/add/addContext";
import { createDeck, createDeckFromReviewer } from "@/shared/api/flashcards";
import DeckFields from "./DeckFields";
import { termsLine } from "./deckWords";
import "../study/study-dialog.css";
import "./flashcards-tab.css";

const SOURCE_OPTIONS = [
  { value: "reviewer", label: "From a reviewer" },
  { value: "own", label: "Write my own" },
];
const DEFAULT_MAX_TITLE = 120;
const LOAD_ERROR = "Couldn't load your reviewers. Close this and try again.";

// The reviewer to start on: the first one that has key terms.
const firstUsable = (sources) => sources?.find((source) => source.terms > 0)?.reviewerId ?? "";

function SourceOption({ source, picked, onPick, disabled }) {
  const empty = source.terms === 0;
  return (
    <label className={`fc-option${empty ? " is-disabled" : ""}`}>
      <input
        type="radio"
        name="flashcards-reviewer"
        className="fc-option__input"
        checked={picked}
        onChange={onPick}
        disabled={empty || disabled}
      />
      <span className="fc-option__mark" aria-hidden="true" />
      <span className="fc-option__text">
        <span className="fc-option__title">{source.title}</span>
        <span className="fc-option__sub">{termsLine(source.terms)}</span>
      </span>
      {source.deckId && <Chip tone="neutral">Has a deck</Chip>}
    </label>
  );
}

// Make flashcards (Figma 261:860 from a reviewer, 261:993 write my own, 261:1117 no reviewers, 261:1235 on a
// phone). `sources` are the ready reviewers from the flashcards list ({ reviewerId, title, terms, deckId });
// null means they didn't load, and Write my own still works. A reviewer that already has a deck opens it
// instead of making a second one (the server answers `existing`). `defaultSubject` (a subject page's id) presets the
// subject of a deck of your own. On a phone the sheet keeps its close X and
// drops Cancel, as frame 261:1235 draws it. `onSaved(result)` gets { deck, ... }.
export default function MakeFlashcardsDialog({ subjects, sources, limits, defaultSubject, onClose, onSaved }) {
  const { open } = useGlobalAdd();
  const [mode, setMode] = useState("reviewer");
  const [reviewerId, setReviewerId] = useState(() => firstUsable(sources));
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(defaultSubject ?? null); // null shows "Choose a subject"; "" is the No subject option
  const [titleError, setTitleError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const picked = sources?.find((source) => source.reviewerId === reviewerId);
  const noReviewers = sources?.length === 0;
  const reviewerSide = mode === "reviewer";
  const opens = reviewerSide && Boolean(picked?.deckId);

  const chooseMode = (value) => {
    setMode(value);
    setError("");
    setTitleError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!reviewerSide && !title.trim()) return setTitleError("Give the deck a title.");
    if (reviewerSide && !picked) return;
    setBusy(true);
    setError("");
    const body = reviewerSide ? undefined : { title: title.trim(), ...(subject ? { subject } : {}) };
    const result = reviewerSide ? await createDeckFromReviewer(picked.reviewerId) : await createDeck(body);
    if (result.error) {
      setBusy(false);
      return setError(result.error);
    }
    onSaved(result.data);
  };

  const message = error || (reviewerSide && sources === null ? LOAD_ERROR : "");

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      sheet
      className="study-dialog fc-dialog"
      title="Make flashcards"
      subtitle="Turn a reviewer into cards, or write your own."
      busy={busy}
      onClose={onClose}
      confirmClose={() => !reviewerSide && Boolean(title.trim())}
      actions={(close) => (
        <>
          <Button variant="ghost" className="fc-dialog__cancel" onClick={close} disabled={busy}>Cancel</Button>
          <Button type="submit" busy={busy} disabled={reviewerSide && !picked}>
            {opens ? "Open deck" : reviewerSide ? "Make flashcards" : "Make deck"}
          </Button>
        </>
      )}
    >
      <Segment label="Source" options={SOURCE_OPTIONS} value={mode} onChange={chooseMode} disabled={busy} />
      {reviewerSide && sources?.length > 0 && (
        <div className="fc-options" role="radiogroup" aria-label="Reviewer">
          {sources.map((source) => (
            <SourceOption
              key={source.reviewerId}
              source={source}
              picked={source.reviewerId === reviewerId}
              onPick={() => setReviewerId(source.reviewerId)}
              disabled={busy}
            />
          ))}
        </div>
      )}
      {reviewerSide && noReviewers && (
        <div className="fc-none">
          <p className="fc-none__text">Make a reviewer first, then turn its key terms into cards.</p>
          <Button variant="secondary" onClick={() => open("reviewer")}>New reviewer</Button>
        </div>
      )}
      {!reviewerSide && (
        <DeckFields
          title={title}
          onTitle={(value) => {
            setTitle(value);
            setTitleError("");
            setError("");
          }}
          subject={subject}
          onSubject={setSubject}
          subjects={subjects}
          titleError={titleError}
          maxTitle={limits?.title ?? DEFAULT_MAX_TITLE}
          disabled={busy}
        />
      )}
      {message && <p className="study-dialog__error" role="alert">{message}</p>}
    </Modal>
  );
}
