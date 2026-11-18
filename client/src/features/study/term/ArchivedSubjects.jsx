import { Link } from "react-router-dom";
import { Archive, Clock, RotateCcw } from "lucide-react";
import { Button, Card, Chip, EmptyState, Skeleton } from "@/shared/ui";
import { plural } from "@/shared/lib/plural";
import { subjectMeta } from "@/utils/subjectColors";

// One archived subject (TR-1): a grey band, its code and term, how many class times are kept for it, its open
// tasks and reviewers (they are still listed on its page), and Restore. The name opens the subject.
function ArchivedCard({ subject, onRestore }) {
  const meta = subjectMeta(subject);
  const kept = subject.pastClassTimes?.length ?? 0;
  return (
    <Card className="term-archived">
      <span className="term-archived__band" aria-hidden="true" />
      <div className="term-archived__body">
        <div className="term-archived__top">
          <div className="term-archived__titles">
            <Link to={`/study/subjects/${subject._id}`} className="term-archived__name">{subject.name}</Link>
            {meta && <span className="term-archived__meta">{meta}</span>}
          </div>
          <Chip tone="neutral">Archived</Chip>
        </div>
        <span className="term-archived__line">
          <Clock size={20} aria-hidden="true" />
          <span>{kept > 0 ? `${plural(kept, "class time")} saved` : "No class times saved"}</span>
        </span>
        <span className="term-archived__line term-archived__line--plain">
          {plural(subject.counts.openTasks, "task")} · {plural(subject.counts.reviewers, "reviewer")}
        </span>
        <Button variant="secondary" icon={RotateCcw} className="term-archived__restore" onClick={() => onRestore(subject)}>
          Restore
          <span className="sr-only"> {subject.name}</span>
        </Button>
      </div>
    </Card>
  );
}

// The Archived view of Study's subjects (TR-1). `archived` is useArchivedSubjects' answer; `onRestore` opens the
// confirm for one subject.
export default function ArchivedSubjects({ archived, onRestore }) {
  if (archived.status === "loading") {
    return (
      <div className="study-grid" role="status" aria-label="Loading your archived subjects">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="study-skeleton" height="168px" />)}
      </div>
    );
  }
  if (archived.status === "failed") {
    return (
      <div className="study-failed" role="alert">
        <p>{archived.error}</p>
        <Button variant="secondary" onClick={archived.reload}>Try again</Button>
      </div>
    );
  }
  if (archived.subjects.length === 0) {
    return (
      <EmptyState icon={Archive} title="Nothing archived yet">
        Subjects you finish with, or archive when you start a new term, wait here until you restore them.
      </EmptyState>
    );
  }
  return (
    <>
      <p className="term-view-note">Tasks, reviewers, flashcards and files stay with each subject. Restore one to bring its class times back.</p>
      <ul className="study-grid stagger">
        {archived.subjects.map((subject) => (
          <li key={subject._id}>
            <ArchivedCard subject={subject} onRestore={onRestore} />
          </li>
        ))}
      </ul>
    </>
  );
}
