import { useEffect, useState } from "react";
import { fetchFiles } from "@/shared/api/files";
import { usableSources } from "./reviewerForm";

const NONE = [];

// The stored files of one subject that a reviewer can be made from (PDF, Word, PowerPoint, photos).
// Empty while loading, with no subject (`subjectId` ""), and when files are off or the call fails: the
// New reviewer dialog then simply offers the upload field, with no error. An archived subject isn't a
// place the server lists by, so it offers nothing.
export default function useSubjectSources(subjectId, archived) {
  const [loaded, setLoaded] = useState({ subjectId: "", files: NONE });
  const enabled = Boolean(subjectId) && !archived;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetchFiles(`subject:${subjectId}`).then(({ data }) => {
      if (!cancelled && data) setLoaded({ subjectId, files: usableSources(data.files) });
    });
    return () => {
      cancelled = true;
    };
  }, [subjectId, enabled]);

  return enabled && loaded.subjectId === subjectId ? loaded.files : NONE;
}
