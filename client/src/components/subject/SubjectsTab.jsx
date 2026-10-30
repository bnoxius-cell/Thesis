import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, GraduationCap, Plus } from "lucide-react";
import { useAuth } from "../../pages/authentication/AuthContext";
import { fetchSubjects, fetchSuggestions } from "../../utils/subjectApi";
import { subjectMeta } from "../../utils/subjectColors";
import EmptyState from "../EmptyState";
import SubjectDialog from "./SubjectDialog";
import SubjectDot from "./SubjectDot";
import SuggestedSubjects from "./SuggestedSubjects";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const countsText = ({ openTasks, reviewers }) => (
  openTasks || reviewers ? `${plural(openTasks, "open task")} · ${plural(reviewers, "reviewer")}` : "Nothing linked yet"
);

// The Subjects tab on Study: suggestions from what the student already has, then their subjects.
// A subject opens its own page.
export default function SubjectsTab() {
  const { backendUrl } = useAuth();
  const [subjects, setSubjects] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [list, found] = await Promise.all([fetchSubjects(backendUrl), fetchSuggestions(backendUrl)]);
    if (list.data) setSubjects(list.data.subjects);
    setLoadFailed(Boolean(list.error));
    setSuggestions(found.data?.suggestions ?? []);
  }, [backendUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const closeAndReload = () => {
    setCreating(false);
    load();
  };

  if (!subjects) {
    return loadFailed ? (
      <div className="panel reviewer-message">
        <p>Couldn't load your subjects. Check your connection and try again.</p>
        <button type="button" className="secondary-button" onClick={load}>Try again</button>
      </div>
    ) : <div className="panel reviewer-message"><p>Loading your subjects...</p></div>;
  }

  return (
    <div className="subjects-tab">
      <div className="subjects-toolbar">
        <p>Group your tasks and reviewers by class.</p>
        <button type="button" className="primary-button" onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" /> New subject
        </button>
      </div>

      {suggestions.length > 0 && <SuggestedSubjects key={suggestions.map((s) => s.key).join()} suggestions={suggestions} subjects={subjects} onAdded={load} />}

      {subjects.length === 0 ? (
        <section className="panel">
          <EmptyState compact icon={GraduationCap} title="No subjects yet">
            Add the classes you take, and your tasks and reviewers can sit under them.
          </EmptyState>
        </section>
      ) : (
        <ul className="subject-list stagger">
          {subjects.map((s) => (
            <li key={s._id}>
              <Link to={`/study/subjects/${s._id}`} className="subject-row">
                <SubjectDot color={s.color} />
                <span className="subject-row-body">
                  <strong>{s.name}</strong>
                  {subjectMeta(s) && <span className="subject-row-meta">{subjectMeta(s)}</span>}
                  <span className="subject-row-meta">{countsText(s.counts)}</span>
                </span>
                <ChevronRight size={18} aria-hidden="true" className="subject-row-chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {creating && <SubjectDialog subjects={subjects} onClose={() => setCreating(false)} onSaved={closeAndReload} />}
    </div>
  );
}
