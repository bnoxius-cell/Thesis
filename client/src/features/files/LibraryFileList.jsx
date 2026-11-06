import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { moveFile } from "@/shared/api/files";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import useNow from "@/shared/hooks/useNow";
import DeleteFileDialog from "./DeleteFileDialog";
import FileList from "./FileList";
import FilePreviewDialog from "./FilePreviewDialog";
import FolderDialog from "./FolderDialog";
import MovePicker from "./MovePicker";
import useOpenFile from "./useOpenFile";

const FLASH_MS = 600; // the moved chip's flash in files.css

// A list of the student's files with what a row can do: open one (a photo in the preview dialog, a
// document as a download), move one (Move to..., which can also make a new folder first) and delete
// one after asking. `library` is useLibrary's answer; a deleted row collapses, then leaves the list
// and the usage is fetched again. `placeName` adds the place chip: a list with chips mixes places, so
// a moved file stays and its chip flashes; a list of one place lets the moved row collapse away.
// A polite live region says where a file went. A failed move leaves the file where it was.
export default function LibraryFileList({ library, files, placeName }) {
  const now = useNow();
  const phone = useMediaQuery("(max-width: 719.98px)"); // where Move to... is a bottom sheet
  const { previewing, open, closePreview } = useOpenFile();
  const [deleting, setDeleting] = useState(null);
  const [moving, setMoving] = useState(null); // { file, anchor }: the picker is open
  const [folderFor, setFolderFor] = useState(null); // the file to move into a folder being made
  const [movedId, setMovedId] = useState(null);
  const [movingIds, setMovingIds] = useState([]); // moves the server hasn't answered yet
  const [said, setSaid] = useState("");
  const movedOut = useRef(new Map()); // id -> the moved file, while its row collapses
  const listRef = useRef(null);

  useEffect(() => {
    if (!movedId) return undefined;
    const timer = setTimeout(() => setMovedId(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [movedId]);

  const closePicker = (restoreFocus) => {
    if (restoreFocus) moving?.anchor?.focus({ preventScroll: true });
    setMoving(null);
  };

  // One move per file at a time, so answers can't come back out of order and show the wrong place.
  const move = async (file, place, name) => {
    if (movingIds.includes(file.id)) return;
    setMovingIds((ids) => [...ids, file.id]);
    const { data, error } = await moveFile(file.id, place);
    setMovingIds((ids) => ids.filter((id) => id !== file.id));
    if (error) {
      toast.error(error);
      return;
    }
    setSaid(`Moved to ${name}`);
    if (placeName) {
      library.relocate(data.file);
      setMovedId(file.id);
    } else {
      movedOut.current.set(file.id, data.file);
      library.retire(file.id);
    }
  };

  // A row that moved out is about to go. If focus is on it (its More button, where the picker left
  // it), it goes to the More button of the next row still here, else the one before, else the page.
  const handOnFocus = (id) => {
    const row = listRef.current?.querySelector(`[data-file-id="${CSS.escape(id)}"]`);
    const focused = document.activeElement;
    if (focused && focused !== document.body && !row?.contains(focused)) return;
    const at = files.findIndex((file) => file.id === id);
    const nearest = [...files.slice(at + 1), ...files.slice(0, Math.max(at, 0)).reverse()];
    const next = nearest.find((file) => !library.leavingIds.includes(file.id));
    const more = next && listRef.current?.querySelector(`[data-file-id="${CSS.escape(next.id)}"] .ui-menu-anchor button`);
    (more ?? document.getElementById("main"))?.focus({ preventScroll: true });
  };

  return (
    <>
      <FileList
        files={files}
        freshIds={library.freshIds}
        leavingIds={library.leavingIds}
        movedId={movedId}
        movingIds={movingIds}
        now={now}
        placeName={placeName}
        listRef={listRef}
        onOpen={open}
        onMove={(file, anchor) => setMoving({ file, anchor })}
        onDelete={setDeleting}
        onGone={(id) => {
          const moved = movedOut.current.get(id);
          if (moved) {
            movedOut.current.delete(id);
            handOnFocus(id);
            library.relocate(moved);
          } else {
            library.remove(id);
            library.refresh();
          }
        }}
      />
      <p className="sr-only" role="status">{said}</p>
      {moving && (
        <MovePicker
          file={moving.file}
          anchor={moving.anchor}
          locations={library.locations}
          phone={phone}
          onClose={closePicker}
          onPick={(place, name) => {
            closePicker(true);
            move(moving.file, place, name);
          }}
          onNewFolder={() => {
            closePicker(true);
            setFolderFor(moving.file);
          }}
        />
      )}
      {folderFor && (
        <FolderDialog
          onClose={() => setFolderFor(null)}
          onSaved={async (folder) => {
            setFolderFor(null);
            await move(folderFor, `folder:${folder.id}`, folder.name);
            library.refresh(); // the new folder joins the places
          }}
        />
      )}
      {previewing && (
        <FilePreviewDialog
          file={previewing}
          now={now}
          onClose={closePreview}
          onDelete={(file) => {
            closePreview();
            setDeleting(file);
          }}
        />
      )}
      {deleting && (
        <DeleteFileDialog
          file={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(file) => {
            setDeleting(null);
            library.retire(file.id);
          }}
        />
      )}
    </>
  );
}
