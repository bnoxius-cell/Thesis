import { Plus } from "lucide-react";
import SubjectCard from "./SubjectCard";
import SubjectMenu from "./SubjectMenu";

// The subject cards, three across on wide screens and one on phones, ending with the dashed New
// subject card (it stretches to the tallest card in its row; the others keep their own height). The first six arrive one after another (the shared stagger); cards keep their
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
      <li key="new" className="study-grid__new">
        <button type="button" className="study-new" onClick={onNew}>
          <span className="study-new__chip" aria-hidden="true"><Plus size={20} /></span>
          <span className="study-new__label">New subject</span>
          <span className="study-new__hint">Add a class to keep its notes and files together</span>
        </button>
      </li>
    </ul>
  );
}
