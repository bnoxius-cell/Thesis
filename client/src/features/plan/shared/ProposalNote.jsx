import { UserPen } from "lucide-react";
import "./class-choice.css";

// The line in the class window about proposing the student's own copy to the admins (Figma GW-9, 386:4470): the
// change notice's look, with no buttons (the footer holds Propose and Withdraw).
export default function ProposalNote({ children }) {
  return (
    <div className="class-notice" role="status">
      <UserPen size={20} aria-hidden="true" className="class-notice__icon" />
      <p className="class-notice__text">{children}</p>
    </div>
  );
}
