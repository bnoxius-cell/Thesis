import MakeFlashcardsDialog from "@/features/flashcards/MakeFlashcardsDialog";
import JoinGroupDialog from "@/features/people/JoinGroupDialog";
import NewGroupDialog from "@/features/people/NewGroupDialog";
import EntryFormDialog from "@/features/plan/EntryFormDialog";
import NewReviewerDialog from "@/features/study/NewReviewerDialog";
import NewSubjectDialog from "@/features/study/NewSubjectDialog";
import TaskFormDialog from "@/features/tasks/TaskFormDialog";
import AddUploadDialog from "./AddUploadDialog";
import useAddInputs from "./useAddInputs";

// The one dialog host: the form for `request.kind`, using what the page that opened it holds (`request.page`,
// see useAddHere). `onSaved(kind, result)` runs after a save, `onSubjectMade()` when a reviewer's dialog made
// a new subject with it, and `onClose` when the student leaves without saving.
export default function AddDialogs({ request, onClose, onSaved, onSubjectMade }) {
  const { kind, page } = request;
  const inputs = useAddInputs(kind, page);
  if (!inputs) return null;
  const { subjects, limits, sources } = inputs;

  if (kind === "task") {
    return (
      <TaskFormDialog
        subjects={subjects}
        defaultSubject={page?.subject?._id}
        onClose={onClose}
        onSaved={(task) => onSaved("task", task)}
      />
    );
  }
  if (kind === "file") return <AddUploadDialog onClose={onClose} />;
  if (kind === "group") return <NewGroupDialog onClose={onClose} onDone={(group) => onSaved("group", group)} />;
  if (kind === "join") return <JoinGroupDialog onClose={onClose} onDone={(group) => onSaved("join", group)} />;
  if (kind === "subject") {
    return <NewSubjectDialog onClose={onClose} onSaved={(_editing, subject) => onSaved("subject", subject)} />;
  }
  if (kind === "reviewer") {
    return (
      <NewReviewerDialog
        subjects={subjects}
        defaultSubject={page?.subject?._id}
        allowNewSubject={!page?.subject}
        limits={limits}
        onClose={onClose}
        onCreated={() => onSaved("reviewer")}
        onSubjectCreated={onSubjectMade}
      />
    );
  }
  if (kind === "flashcards") {
    return (
      <MakeFlashcardsDialog
        subjects={subjects}
        sources={sources}
        limits={limits}
        onClose={onClose}
        onSaved={(result) => onSaved("flashcards", result)}
      />
    );
  }
  // The Type segment can switch kinds inside the dialog, so the kind that was saved comes back from it.
  return (
    <EntryFormDialog
      kind={kind}
      subjects={subjects}
      timetable={page?.timetable ?? null}
      onClose={onClose}
      onSaved={(schedule, saved, entry) => onSaved(saved, { schedule, entry })}
    />
  );
}
