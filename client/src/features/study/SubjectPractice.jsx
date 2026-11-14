import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
import { Button, EmptyState, Segment } from "@/shared/ui";
import FlashcardsPanel from "@/features/flashcards/FlashcardsPanel";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import ReviewerList from "./ReviewerList";

const OPTIONS = [
  { value: "reviewers", label: "Reviewers" },
  { value: "flashcards", label: "Flashcards" },
];

// The Practice tab of a subject (Figma FC-F17 `Subject / 1440 / light / practice flashcards`, phone 375): the
// Reviewers | Flashcards Segment, then this subject's reviewers or its decks, with "New reviewer" or "Make
// flashcards" at the right of the Segment once there is something listed. On a phone Make flashcards floats above
// the bottom bar (the Files tab's pattern); it is portalled out of the panel so the tab's entrance animation
// can't carry it. The empty states carry their own button.
// `reviewers` is null when they could not load. `flashcards` is useFlashcards' answer for every deck; only this
// subject's decks show, and without the Study page's due card (its Start review would open every subject's).
// `onNewReviewer` and `onMake` open the global add's dialogs on this subject.
export default function SubjectPractice({ subject, show, onShow, reviewers, flashcards, entries, now, onNewReviewer, onMake }) {
  const phone = useMediaQuery("(max-width: 1023px)"); // where the bottom bar is
  const decks = flashcards.data?.decks.filter((deck) => deck.subject === subject._id);
  const mine = flashcards.data ? { ...flashcards, data: { ...flashcards.data, decks } } : flashcards;
  const showMake = show === "flashcards" && decks?.length > 0;
  const showNew = show === "reviewers" && reviewers?.length > 0;

  return (
    <div className="subject-stack">
      <div className="subject-practice__bar">
        <Segment className="subject-practice__segment" label="Practice section" options={OPTIONS} value={show} onChange={onShow} />
        {showNew && <Button variant="secondary" onClick={onNewReviewer}>New reviewer</Button>}
        {showMake && !phone && <Button onClick={onMake}>Make flashcards</Button>}
      </div>
      {showMake && phone && createPortal(<Button className="subject-practice__float" onClick={onMake}>Make flashcards</Button>, document.body)}
      <div key={show} className={`panel-fade${showMake && phone ? " subject-practice__panel--float" : ""}`}>
        {show === "reviewers" && reviewers && <ReviewerList reviewers={reviewers} onNew={onNewReviewer} />}
        {show === "reviewers" && !reviewers && (
          <EmptyState icon={FileText} title="Couldn't load your reviewers">
            Check your connection, then reload the page.
          </EmptyState>
        )}
        {show === "flashcards" && (
          <FlashcardsPanel flashcards={mine} subjects={[subject]} entries={entries} now={now} onMake={onMake} hideDue />
        )}
      </div>
    </div>
  );
}
