import { Link } from "react-router-dom";
import { ChevronRight, FileText, LoaderCircle } from "lucide-react";

const statusText = (r) => {
  if (r.status === "processing") return "Making it now...";
  if (r.status === "failed") return "Couldn't make this one. Open it to try again.";
  return `${r.questionCount} questions · ${r.topicCount} topics`;
};

// A subject's reviewers as rows. Each one opens that reviewer on Study (?r=).
export default function SubjectReviewerRows({ reviewers }) {
  return (
    <ul className="subject-list is-single stagger">
      {reviewers.map((r) => (
        <li key={r._id}>
          <Link to={`/reviewers?r=${r._id}`} className="subject-row">
            {r.status === "processing"
              ? <LoaderCircle size={20} aria-hidden="true" className="reviewer-spin subject-row-icon" />
              : <FileText size={20} aria-hidden="true" className="subject-row-icon" />}
            <span className="subject-row-body">
              <strong>{r.title}</strong>
              <span className="subject-row-meta">{statusText(r)}</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" className="subject-row-chevron" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
