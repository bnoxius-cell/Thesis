import SubjectCard from "./SubjectCard";

// The subject cards, three across on wide screens and one on phones. The first six arrive one
// after another (the shared stagger).
export default function SubjectGrid({ subjects, entries, now }) {
  return (
    <ul className="study-grid stagger">
      {subjects.map((subject) => (
        <li key={subject._id}>
          <SubjectCard subject={subject} entries={entries} now={now} />
        </li>
      ))}
    </ul>
  );
}
