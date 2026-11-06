import { FileText, Layers, Plus } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";
import ReviewerList from "./ReviewerList";

// The Practice tab's body (Figma 144:654, 146:844). Reviewers is the list with its empty states and,
// on a phone, the dashed New reviewer card under it. Flashcards is a placeholder card until the
// flashcard backend exists. The wrapper is keyed on the Segment's choice, so a switch cross-fades.
// `reviewers` is null while loading and after a failed load.
export default function PracticePanel({ show, reviewers, onNew, onShow }) {
  return (
    <div key={show} className="panel-fade">
      {show === "flashcards" && (
        <EmptyState
          icon={Layers}
          title="Flashcards are on the way"
          className="study-soon"
          actions={<Button variant="ghost" onClick={() => onShow("reviewers")}>Open reviewers</Button>}
        >
          Flashcards from your notes will show up here. Your reviewers are ready to practice in the meantime.
        </EmptyState>
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
