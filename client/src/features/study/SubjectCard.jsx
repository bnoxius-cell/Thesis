import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { Card, Chip } from "@/shared/ui";
import { subjectTone } from "@/shared/lib/subjectTone";
import { subjectMeta } from "@/utils/subjectColors";
import { examChipText, nextClassText } from "./subjectClasses";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// One subject (Figma 72:3, 75:799): colour dot, name, code and term, the next class, how many open
// tasks and reviewers it holds, and an exam chip when an exam is close. The whole card opens it.
export default function SubjectCard({ subject, entries, now }) {
  const meta = subjectMeta(subject);
  const next = nextClassText(entries, subject, now);
  const exam = examChipText(entries, subject, now);

  return (
    <Card as={Link} to={`/study/subjects/${subject._id}`} interactive className="study-subject">
      <span className="study-subject__head">
        <span className={`study-dot study-dot--${subjectTone(subject.color)}`} aria-hidden="true" />
        <span className="study-subject__name">{subject.name}</span>
      </span>
      {meta && <span className="study-subject__meta">{meta}</span>}
      {next && (
        <span className="study-subject__next">
          <Clock size={20} aria-hidden="true" />
          <span>Next: {next}</span>
        </span>
      )}
      <span className="study-subject__foot">
        <span className="study-subject__counts">
          {plural(subject.counts.openTasks, "task")} · {plural(subject.counts.reviewers, "reviewer")}
        </span>
        {exam && <Chip tone="watch">{exam}</Chip>}
      </span>
    </Card>
  );
}
