import useLibrary from "@/features/files/useLibrary";
import useUploads from "@/features/files/useUploads";

// A subject's files and the uploads going to it. The Subject page holds this, not the Files tab, so
// an upload keeps going (and its tray stays) while the student looks at another tab.
// An archived subject isn't a place the server lists by, so it reads every file instead (the tab
// keeps this subject's).
export default function useSubjectFiles(subjectId, archived) {
  const place = `subject:${subjectId}`;
  const library = useLibrary(archived ? undefined : place);
  const uploads = useUploads({ to: place, onUploaded: library.add, onSettled: library.refresh });
  return { library, uploads };
}
