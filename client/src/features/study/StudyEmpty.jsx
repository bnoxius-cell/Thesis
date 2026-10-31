import { BookOpen } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";

const STEPS = ["Add a subject", "Add classes and tasks", "Upload a reviewer"];

// A new account (Figma 78:1526). "Add subject" opens the New subject dialog. "Upload a reviewer" is
// left out until its dialog is built; the three steps stay as the plain picture of how Study works.
export default function StudyEmpty({ onAddSubject }) {
  return (
    <EmptyState
      page
      icon={BookOpen}
      title="Add your first subject"
      className="study-empty"
      actions={
        <>
          <ol className="study-steps">
            {STEPS.map((step, i) => (
              <li key={step}><b>{i + 1}</b> {step}</li>
            ))}
          </ol>
          <Button onClick={onAddSubject}>Add subject</Button>
        </>
      }
    >
      Subjects keep your classes, tasks, notes and reviewers in one place. It takes a minute.
    </EmptyState>
  );
}
