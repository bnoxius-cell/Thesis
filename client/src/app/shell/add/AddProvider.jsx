import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FLASHCARDS_TAB } from "@/features/flashcards/flashcardLinks";
import { showActionToast } from "@/shared/ui";
import AddDialogs from "./AddDialogs";
import { AddContext } from "./addContext";
import { addedToast } from "./addOptions";

// Holds the global add for the signed-in area: which dialog is open, and the page that said (through
// useAddHere) what it holds. After a save it closes the dialog, tells that page so it can refresh, and
// toasts with a View button. It never navigates by itself, except that a saved deck opens the Flashcards tab.
export default function AddProvider({ children }) {
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const current = useRef(null);

  // Two kinds aren't hosted here: Add a friend is a navigation the student asked for, and File goes to the
  // page's own Upload dialog when the page holds the upload queue (Files, a Subject).
  const open = useCallback(
    (kind) => {
      if (kind === "friend") navigate("/people/friends?add=1");
      else if (kind === "file" && current.current?.openUpload) current.current.openUpload();
      else setRequest({ kind, page: current.current });
    },
    [navigate],
  );
  const close = useCallback(() => setRequest(null), []);
  const register = useCallback((context) => {
    current.current = context;
    return () => {
      if (current.current === context) current.current = null;
    };
  }, []);
  const value = useMemo(() => ({ open, close, register }), [open, close, register]);

  // A page that was left while its dialog was open has unregistered and hears nothing.
  const tellPage = (kind, result) => {
    if (request.page && current.current === request.page) request.page.onAdded(kind, result);
  };

  const saved = (kind, result) => {
    // A deck shows up on the Flashcards tab, which says so itself: no toast, just take the student there.
    if (kind === "flashcards") {
      setRequest(null);
      tellPage(kind, result);
      navigate(FLASHCARDS_TAB);
      return;
    }
    const { message, href } = addedToast(kind, result);
    setRequest(null);
    tellPage(kind, result);
    showActionToast(message, { label: "View", onAction: () => navigate(href) });
  };

  return (
    <AddContext.Provider value={value}>
      {children}
      {request && <AddDialogs request={request} onClose={close} onSaved={saved} onSubjectMade={() => tellPage("subject")} />}
    </AddContext.Provider>
  );
}
