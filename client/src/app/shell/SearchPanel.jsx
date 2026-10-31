import { BookOpen, FileText, ListChecks } from "lucide-react";
import { Button } from "@/shared/ui";
import { SEARCH_KINDS } from "./searchIndex";

const KIND_ICONS = { subject: BookOpen, reviewer: FileText, task: ListChecks };

// The list under the search bar: results, or one quiet line saying why there are none.
// `optionId(i)` names each row so the input can point at the highlighted one.
export default function SearchPanel({ id, status, query, results, active, optionId, onPick, onRetry }) {
  if (status === "failed") {
    return (
      <div className="shell-search__note" role="alert">
        <p>We couldn't load your things to search.</p>
        <Button variant="secondary" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  if (status === "idle" || status === "loading") {
    return <p className="shell-search__note" role="status">Loading your things</p>;
  }
  if (!query) {
    return <p className="shell-search__note">Search your subjects, reviewers and tasks.</p>;
  }
  if (results.length === 0) {
    return <p className="shell-search__note" role="status">Nothing matches "{query}".</p>;
  }
  return (
    <ul id={id} role="listbox" aria-label="Search results" className="shell-search__list">
      {results.map((entry, i) => {
        const Icon = KIND_ICONS[entry.kind];
        return (
          <li
            key={entry.key}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            className="shell-search__option"
            data-active={i === active || undefined}
            onClick={() => onPick(entry)}
          >
            <Icon size={18} aria-hidden="true" />
            <span className="shell-search__text">
              <span className="shell-search__label">{entry.label}</span>
              {entry.sub && <span className="shell-search__sub">{entry.sub}</span>}
            </span>
            <span className="shell-search__kind">{SEARCH_KINDS[entry.kind]}</span>
          </li>
        );
      })}
    </ul>
  );
}
