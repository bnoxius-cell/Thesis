import { Plus } from "lucide-react";
import { MAX_NEW_SUBJECTS } from "./newTermForm";
import TermSubjectCard from "./TermSubjectCard";

// The new subjects of step 2 (TR-3): a card each, then the dashed Add subject. `term` is useNewTerm's answer.
export default function TermSubjectRows({ term }) {
  const { subjects } = term.form;
  const full = subjects.length >= MAX_NEW_SUBJECTS;
  return (
    <div className="term-subjects">
      {subjects.map((subject) => (
        <TermSubjectCard
          key={subject.key}
          subject={subject}
          errors={term.errors[subject.key]}
          notes={term.notes}
          onChange={(fields) => term.changeSubject(subject.key, fields)}
          onRemove={() => term.removeSubject(subject.key)}
          onAddTime={() => term.addClassTime(subject.key)}
          onChangeTime={(timeKey, fields) => term.changeClassTime(subject.key, timeKey, fields)}
          onRemoveTime={(timeKey) => term.removeClassTime(subject.key, timeKey)}
        />
      ))}
      <button type="button" className="term-add-subject" disabled={full} onClick={term.addSubject}>
        <Plus size={20} aria-hidden="true" />
        <span>{full ? `${MAX_NEW_SUBJECTS} subjects is the most for one term` : "Add subject"}</span>
      </button>
    </div>
  );
}
