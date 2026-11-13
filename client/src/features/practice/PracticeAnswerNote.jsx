import { CircleCheck } from "lucide-react";

// The right answer under a typed answer that missed, in good (Figma QT-F6c, QT-F8b). Never red.
export default function PracticeAnswerNote({ children }) {
  return (
    <p className="practice-note">
      <CircleCheck size={20} aria-hidden="true" />
      <span className="practice-note__text">{children}</span>
    </p>
  );
}
