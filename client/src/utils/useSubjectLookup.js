import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../pages/authentication/AuthContext";
import { fetchSubjects } from "./subjectApi";

// The student's subjects as a Map by id, for rows that show a subject's dot next to a task.
// Empty until the list arrives (and if it never does), so a row just shows no dot.
export default function useSubjectLookup() {
  const { backendUrl } = useAuth();
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchSubjects(backendUrl).then(({ data }) => {
      if (!cancelled && data) setSubjects(data.subjects);
    });
    return () => { cancelled = true; };
  }, [backendUrl]);

  return useMemo(() => new Map(subjects.map((s) => [s._id, s])), [subjects]);
}
