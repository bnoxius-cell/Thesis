import { useEffect, useState } from "react";
import { useAuth } from "../../pages/authentication/AuthContext";
import { fetchSubjects } from "../../utils/subjectApi";
import { subjectForLabel } from "../../utils/subjectColors";
import SubjectDialog from "./SubjectDialog";

const NEW_SUBJECT = "__new";

// A select of the student's subjects with "No subject" and "New subject...". The last one opens the
// subject dialog on top of whatever dialog this sits in, then selects the subject it made.
//
//   id, value, onChange   the select's id, the chosen subject id ("" for none), and (id) => void
//   legacyLabel           the old free-text course on an item with no subject. When no subject
//                         matches it, "Make it a subject" turns it into one.
export default function SubjectPicker({ id, value, onChange, legacyLabel = "", disabled = false }) {
  const { backendUrl } = useAuth();
  const [subjects, setSubjects] = useState(null);
  const [dialog, setDialog] = useState(null); // { initial } while the dialog is open

  useEffect(() => {
    let cancelled = false;
    fetchSubjects(backendUrl).then(({ data }) => {
      if (!cancelled) setSubjects(data?.subjects ?? []);
    });
    return () => { cancelled = true; };
  }, [backendUrl]);

  const list = subjects ?? [];
  const showLegacy = subjects && !value && legacyLabel.trim() && !subjectForLabel(legacyLabel, list);

  const pick = (e) => {
    if (e.target.value === NEW_SUBJECT) setDialog({ initial: undefined });
    else onChange(e.target.value);
  };

  const saved = ({ subject }) => {
    setSubjects((current) => [...(current ?? []), subject]);
    onChange(subject._id);
    setDialog(null);
  };

  return (
    <>
      <select id={id} className="subject-picker" value={value} onChange={pick} disabled={disabled}>
        <option value="">No subject</option>
        {list.map((s) => (
          <option key={s._id} value={s._id}>{s.code ? `${s.name} · ${s.code}` : s.name}</option>
        ))}
        <option value={NEW_SUBJECT}>New subject...</option>
      </select>
      {showLegacy && (
        <p className="subject-legacy">
          Now labelled "{legacyLabel.trim()}".{" "}
          <button type="button" className="subject-legacy-action" onClick={() => setDialog({ initial: { name: legacyLabel.trim() } })}>
            Make it a subject
          </button>
        </p>
      )}
      {dialog && (
        <SubjectDialog initial={dialog.initial} subjects={list} onClose={() => setDialog(null)} onSaved={saved} />
      )}
    </>
  );
}
