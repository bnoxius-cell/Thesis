import { Plus } from "lucide-react";
import { NEW_SUBJECT } from "./subjectForm";

// The Subject dropdown's last option, shared by the New reviewer and class forms: a Plus mark and the form's own wording.
export default function newSubjectOption(label) {
  return { value: NEW_SUBJECT, label, leading: <Plus size={18} aria-hidden="true" /> };
}
