import { useCallback, useState } from "react";
import NewTermDialog from "./NewTermDialog";

// The "Start a new term" wizard for a page's entry point.
//   const newTerm = useStartNewTerm({ onApplied });
//   <Button onClick={newTerm.open}>Start a new term</Button>, then render {newTerm.dialog} once.
// `onApplied` runs when the wizard closes after the term was applied, so the page can read its subjects and
// timetable again.
export default function useStartNewTerm({ onApplied }) {
  const [opened, setOpened] = useState(false);
  const open = useCallback(() => setOpened(true), []);
  const close = useCallback(() => setOpened(false), []);
  const dialog = opened && <NewTermDialog onClose={close} onApplied={onApplied} />;
  return { open, dialog };
}
