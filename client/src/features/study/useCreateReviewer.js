import { useCallback, useState } from "react";
import { createReviewer } from "@/shared/api/reviewers";
import { reviewerPayload } from "./reviewerForm";

// Sends a new reviewer. create() answers true when the server took it (the reviewer is then still
// being written); otherwise `error` holds the server's plain message and the dialog stays open.
export default function useCreateReviewer() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const create = useCallback(async (fields) => {
    setCreating(true);
    setError("");
    const { error: failure } = await createReviewer(reviewerPayload(fields));
    setCreating(false);
    if (failure) setError(failure);
    return !failure;
  }, []);

  return { create, creating, error, clearError: () => setError("") };
}
