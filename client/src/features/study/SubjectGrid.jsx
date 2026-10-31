import { Plus } from "lucide-react";
import SubjectCard from "./SubjectCard";
import SubjectMenu from "./SubjectMenu";

// The subject cards, three across on wide screens and one on phones, ending with the dashed New
// subject card. The first six arrive one after another (the shared stagger); cards keep their
// keys, so a refresh after a change doesn't replay them.
export default function SubjectGrid({ subjects, entries, now, onNew, onEdit, onDelete }) {
  return (
    <ul className="study-grid stagger">
      {subjects.map((subject) => (
        <li key={subject._id}>
          <SubjectCard subject={subject} entries={entries} now={now} />
          <SubjectMenu subject={subject} onEdit={onEdit} onDelete={onDelete} />
        </li>
      ))}
      <li key="new">
        <button type="button" className="study-new" onClick={onNew}>
          <Plus size={20} aria-hidden="true" />
          New subject
        </button>
      </li>
    </ul>
  );
}
