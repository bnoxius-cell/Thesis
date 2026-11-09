import { useCallback, useRef, useState } from "react";
import { createReviewer } from "@/shared/api/reviewers";
import { createSubject } from "@/shared/api/subjects";
import { reviewerPayload } from "./reviewerForm";
import { subjectPayload } from "./subjectForm";

// Sends a new reviewer. create() answers true when the server took it (the reviewer is then still
// being written); otherwise `error` holds the server's plain message and the dialog stays open.
// With `newSubjectName`, the subject is made first and the reviewer goes into it. If only the
// reviewer fails, the made subject is kept for the retry, so Create never makes a second one.
// `onSubjectCreated` runs once the subject exists (the page's chance to list it).
export default function useCreateReviewer({ onSubjectCreated } = {}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const madeSubject = useRef("");

  // Answers a failure message, or "" when the reviewer was sent.
  const send = useCallback(
    async ({ newSubjectName, ...fields }) => {
      let subject = fields.subject;
      if (newSubjectName !== undefined) {
        if (!madeSubject.current) {
          const { data, error: failure } = await createSubject(subjectPayload({ name: newSubjectName }));
          if (failure) return failure;
          madeSubject.current = data.subject._id;
          onSubjectCreated?.();
        }
        subject = madeSubject.current;
      }
      const { error: failure } = await createReviewer(reviewerPayload({ ...fields, subject }));
      return failure ?? "";
    },
    [onSubjectCreated],
  );

  const create = useCallback(
    async (fields) => {
      setCreating(true);
      setError("");
      const failure = await send(fields);
      setCreating(false);
      setError(failure);
      return !failure;
    },
    [send],
  );

  return { create, creating, error, clearError: () => setError("") };
}
