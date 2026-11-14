import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FileQuestion, Layers } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import { useFocusView } from "@/app/shell/focusView";
import usePageTitle from "@/app/usePageTitle";
import FlashcardStudy from "./FlashcardStudy";
import { FLASHCARDS_TAB, deckHref } from "./flashcardLinks";
import useFlashcardRun from "./useFlashcardRun";
import "../practice/practice.css";

function Message({ icon, title, children, exit, onRetry }) {
  return (
    <div className="practice">
      <div className="practice-main">
        <EmptyState
          icon={icon}
          title={title}
          titleAs="h1"
          actions={
            <>
              <Button onClick={exit}>Back</Button>
              {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
            </>
          }
        >
          {children}
        </EmptyState>
      </div>
    </div>
  );
}

// The review run (Figma 164:3499 to 164:3598, FC-F14 when nothing is due): a focus screen with no shell.
// /study/flashcards/review[?deck=<id>] studies what is due now, across every deck or in one. Ratings are
// saved in the background by useFlashcardRun, so a slow network never holds up the next card.
export default function FlashcardReviewPage() {
  const deckId = useSearchParams()[0].get("deck") || "";
  const navigate = useNavigate();
  const stateFrom = useLocation().state?.from;
  const from = typeof stateFrom === "string" && stateFrom.startsWith("/") && !stateFrom.startsWith("//") ? stateFrom : "";
  const run = useFlashcardRun(deckId);
  const { finish } = run;
  useFocusView(true);
  usePageTitle("Flashcards");

  const exit = useCallback(() => {
    navigate(from || (deckId ? deckHref(deckId) : FLASHCARDS_TAB), { replace: true });
  }, [navigate, from, deckId]);

  // Until the end screen (FC5) the run just goes back to where it started.
  const onFinish = useCallback(async () => {
    const { reviewed, unsaved } = await finish();
    const cards = `${reviewed} ${reviewed === 1 ? "card" : "cards"}`;
    toast.info(unsaved ? `Done. ${cards} reviewed, but ${unsaved} couldn't be saved.` : `Done. ${cards} reviewed.`);
    exit();
  }, [finish, exit]);

  if (run.status === "loading") {
    return (
      <div className="practice">
        <div className="practice-main">
          <div className="practice-column" role="status" aria-label="Getting your cards ready">
            <Skeleton height="20px" width="30%" />
            <Skeleton height="300px" />
            <Skeleton height="52px" />
          </div>
        </div>
      </div>
    );
  }
  if (run.status === "loaded") {
    return (
      <FlashcardStudy
        key={run.run}
        cards={run.cards}
        course={run.deck?.course}
        title={run.deck?.title || "Due today"}
        onExit={exit}
        onRate={run.rate}
        onFinish={onFinish}
      />
    );
  }
  if (run.status === "empty") {
    return (
      <Message icon={Layers} title="Nothing due right now" exit={exit}>
        Your next cards are due tomorrow.
      </Message>
    );
  }
  if (run.status === "missing") {
    return (
      <Message icon={FileQuestion} title="Deck not found" exit={exit}>
        It may have been deleted, or it isn't in your account.
      </Message>
    );
  }
  return (
    <Message icon={FileQuestion} title="Couldn't start the review" exit={exit} onRetry={run.reload}>
      {run.error}
    </Message>
  );
}
