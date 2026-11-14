import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FileQuestion, Layers } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import { useFocusView } from "@/app/shell/focusView";
import usePageTitle from "@/app/usePageTitle";
import FlashcardDone from "./FlashcardDone";
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
  const location = useLocation();
  const stateFrom = location.state?.from;
  const from = typeof stateFrom === "string" && stateFrom.startsWith("/") && !stateFrom.startsWith("//") ? stateFrom : "";
  const back = from || (deckId ? deckHref(deckId) : FLASHCARDS_TAB);
  const run = useFlashcardRun(deckId);
  const { complete } = run;
  useFocusView(true);
  usePageTitle("Flashcards");

  const exit = useCallback(() => {
    navigate(back, { replace: true });
  }, [navigate, back]);

  // A new run over what is still due: the same address and state (so Back still lands where the first run
  // started), replaced rather than pushed, which reloads the review and keys a fresh study screen.
  const again = useCallback(() => {
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: location.state });
  }, [navigate, location]);

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
  if (run.status === "loaded" && run.summary) {
    return (
      <FlashcardDone
        summary={run.summary}
        practice={run.mode === "all"}
        title={[run.deck?.course, run.deck?.title].filter(Boolean).join(" · ")}
        backLabel={back.startsWith("/study/flashcards/") ? "Back to deck" : "Back to Practice"}
        onBack={exit}
        onAgain={again}
      />
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
        onFinish={complete}
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
