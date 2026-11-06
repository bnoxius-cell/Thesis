import { BookOpen } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";

const STEPS = ["Add a subject", "Add classes and tasks", "Upload a reviewer"];

// A new account (Figma 78:1526). "Add subject" opens the New subject dialog and "Upload a reviewer"
// the New reviewer one; the three steps are the plain picture of how Study works.
export default function StudyEmpty({ onAddSubject, onUpload }) {
  return (
    <EmptyState
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
          <div className="study-empty__buttons">
            <Button variant="ghost" onClick={onUpload}>Upload a reviewer</Button>
            <Button onClick={onAddSubject}>Add subject</Button>
          </div>
        </>
      }
    >
      Subjects keep your classes, tasks, files and reviewers in one place. It takes a minute.
    </EmptyState>
  );
}
