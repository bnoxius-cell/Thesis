import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Chip } from "@/shared/ui";
import { reviewerChip, reviewerMeta, reviewerProgress } from "./reviewerStatus";

// One reviewer (Figma 73:387): file icon, title and meta, subject chip, Learning Mode progress,
// status chip, Open. The whole row is the link to the reviewer. The status chip is keyed by its
// label, so when "Making it" turns into its final state the chip is replaced and settles in.
export default function ReviewerRow({ reviewer }) {
  const chip = reviewerChip(reviewer);
  const progress = reviewerProgress(reviewer);

  return (
    <Link to={`/study/reviewers/${reviewer._id}`} className="study-reviewer">
      <span className="study-reviewer__icon" aria-hidden="true"><FileText size={20} /></span>
      <span className="study-reviewer__text">
        <strong className="study-reviewer__title">{reviewer.title}</strong>
        <span className="study-reviewer__meta">{reviewerMeta(reviewer)}</span>
      </span>
      <span className="study-reviewer__side">
        {reviewer.course && <Chip tone="neutral">{reviewer.course}</Chip>}
        {progress && <span className="study-reviewer__progress">{progress}</span>}
        <Chip
          key={chip.label}
          tone={chip.tone}
          className={chip.busy ? "study-chip study-chip--busy" : "study-chip"}
          role={chip.busy ? "status" : undefined}
        >
          {chip.label}
        </Chip>
        <span className="study-reviewer__open" aria-hidden="true">Open</span>
      </span>
    </Link>
  );
}
