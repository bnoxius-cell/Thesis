import { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../pages/authentication/AuthContext";
import { createSubjectRequest } from "../../utils/subjectApi";
import { linkedMessage, nextSubjectColor } from "../../utils/subjectColors";
import BusySpinner from "../BusySpinner";

const SOURCE_WORDS = { tasks: "tasks", reviewers: "reviewers", schedule: "timetable" };

// "From tasks and timetable"
const fromWhere = (sources) => `From ${sources.map((s) => SOURCE_WORDS[s]).join(" and ")}`;

// The course names the student already uses, ready to become subjects in one tap. All start ticked.
//
//   suggestions   [{ label, key, sources, count }] from GET /api/subjects/suggestions
//   subjects      the current subjects, so each new one gets a colour nobody uses yet
//   onAdded       () => void, to reload the lists
export default function SuggestedSubjects({ suggestions, subjects, onAdded }) {
  const { backendUrl } = useAuth();
  const [skipped, setSkipped] = useState(() => new Set());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const chosen = suggestions.filter((s) => !skipped.has(s.key));

  const toggle = (key) => setSkipped((current) => {
    const next = new Set(current);
    if (!next.delete(key)) next.add(key);
    return next;
  });

  // One at a time so each takes the next unused colour.
  const addSelected = async () => {
    setAdding(true);
    setError("");
    const made = [...subjects];
    const linked = { tasks: 0, reviewers: 0 };
    let added = 0;
    for (const suggestion of chosen) {
      const { data, error: message } = await createSubjectRequest(backendUrl, { name: suggestion.label, color: nextSubjectColor(made) });
      if (message) {
        setError(message);
        break;
      }
      made.push(data.subject);
      linked.tasks += data.linked.tasks;
      linked.reviewers += data.linked.reviewers;
      added += 1;
    }
    setAdding(false);
    if (added) {
      toast.success(`Added ${added} ${added === 1 ? "subject" : "subjects"}. ${linkedMessage(linked)}`.trim());
      onAdded();
    }
  };

  return (
    <section className="panel subject-suggest" aria-labelledby="subject-suggest-title">
      <h2 id="subject-suggest-title">We found these in your tasks and timetable</h2>
      <ul className="subject-suggest-list">
        {suggestions.map((s) => (
          <li key={s.key}>
            <label className="subject-suggest-item">
              <input type="checkbox" checked={!skipped.has(s.key)} onChange={() => toggle(s.key)} disabled={adding} />
              <span className="subject-suggest-text">
                <strong>{s.label}</strong>
                <small>{fromWhere(s.sources)}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="subject-suggest-actions">
        <button type="button" className="primary-button" onClick={addSelected} disabled={adding || chosen.length === 0} aria-busy={adding}>
          {adding && <BusySpinner />}
          {adding ? "Adding..." : `Add selected (${chosen.length})`}
        </button>
      </div>
    </section>
  );
}
