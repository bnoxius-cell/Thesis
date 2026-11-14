import { FileText, Plus } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import FlashcardsPanel from "@/features/flashcards/FlashcardsPanel";
import ReviewerList from "./ReviewerList";

// The Practice tab's body (Figma 144:654, 146:844). Reviewers is the list with its empty states and,
// on a phone, the dashed New reviewer card under it. Flashcards is the due card and the decks (features/
// flashcards). The wrapper is keyed on the Segment's choice, so a switch cross-fades.
// `reviewers` is null while loading and after a failed load. `flashcards` is useFlashcards' answer.
export default function PracticePanel({ show, reviewers, flashcards, subjects, entries, now, onNew, onMake }) {
  return (
    <div key={show} className="panel-fade">
      {show === "flashcards" && (
        <FlashcardsPanel flashcards={flashcards} subjects={subjects} entries={entries} now={now} onMake={onMake} />
      )}
      {show === "reviewers" && reviewers && (
        <>
          <ReviewerList reviewers={reviewers} onNew={onNew} />
          {reviewers.length > 0 && (
            <button type="button" className="study-new study-new--phone-only" onClick={onNew}>
              <span className="study-new__chip" aria-hidden="true"><Plus size={20} /></span>
              <span className="study-new__label">New reviewer</span>
            </button>
          )}
        </>
      )}
      {show === "reviewers" && !reviewers && (
        <EmptyState icon={FileText} title="Couldn't load your reviewers">
          Check your connection, then reload the page.
        </EmptyState>
      )}
    </div>
  );
}
