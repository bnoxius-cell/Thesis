import { SUBJECT_COLORS } from "../../utils/subjectColors";

// The small colour dot that stands for a subject. Decorative: the name always sits next to it.
export default function SubjectDot({ color }) {
  const key = SUBJECT_COLORS.includes(color) ? color : "slate";
  return <span className="subject-dot" style={{ "--dot": `var(--subject-${key})` }} aria-hidden="true" />;
}
