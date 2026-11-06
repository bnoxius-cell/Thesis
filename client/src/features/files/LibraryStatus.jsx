import { FileText } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";

// What the Files pages show until the files have loaded: a skeleton, or the plain failure message with
// a way to try again. It renders nothing once `library` is ready.
export default function LibraryStatus({ library }) {
  if (library.status === "loading") {
    return (
      <div className="files-tab" role="status" aria-label="Loading your files">
        <Skeleton className="files-skeleton" height="76px" />
        <Skeleton className="files-skeleton" height="72px" />
        <Skeleton className="files-skeleton" height="72px" />
      </div>
    );
  }
  if (library.status === "failed") {
    return (
      <EmptyState
        icon={FileText}
        title="Couldn't load your files"
        actions={<Button variant="secondary" onClick={library.reload}>Try again</Button>}
      >
        {library.error}
      </EmptyState>
    );
  }
  return null;
}
