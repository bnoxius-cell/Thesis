import { Info } from "lucide-react";
import { uploadBlock } from "@/features/files/fileNotice";
import useLibrary from "@/features/files/useLibrary";
import useUploadDialog from "@/features/files/useUploadDialog";
import useUploads from "@/features/files/useUploads";

const ARCHIVED = { icon: Info, message: "This subject is archived. You can open its files but not add new ones." };

// A subject's files, the uploads going to it and the Upload dialog. The Subject page holds this, not
// the Files tab, so an upload keeps going (and the dialog can be reopened) while the student looks at
// another tab.
//   block       why uploading is off ({ icon, message }), or null: the subject is archived, uploads are
//               paused or the student's space is full
//   openUpload  opens the dialog on this subject; `files` are the ones dropped on the list
// An archived subject isn't a place the server lists by, so it reads every file instead (the tab
// keeps this subject's).
export default function useSubjectFiles(subjectId, archived) {
  const place = `subject:${subjectId}`;
  const library = useLibrary(archived ? undefined : place);
  const uploads = useUploads({ to: place, onUploaded: library.add, onSettled: library.refresh });
  const dialog = useUploadDialog(uploads);
  const block = archived ? ARCHIVED : library.status === "ready" ? uploadBlock(library) : null;
  const openUpload = (files = []) => dialog.open(place, files);
  return { library, uploads, dialog, block, openUpload };
}
