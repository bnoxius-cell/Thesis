import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { FeedbackContext } from "./feedbackContext";

const FeedbackDialog = lazy(() => import("./FeedbackDialog"));

// Holds the feedback dialog for the signed-in area. It lives here, not in the avatar menu, because
// the menu closes the moment a row is picked. The dialog loads the first time it is opened.
export default function FeedbackProvider({ children }) {
  const [open, setOpen] = useState(false);
  const openFeedback = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openFeedback }), [openFeedback]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {open && (
        <Suspense fallback={null}>
          <FeedbackDialog onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </FeedbackContext.Provider>
  );
}
