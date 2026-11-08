import { useCallback, useEffect, useState } from "react";
import { isBusy } from "./useUploads";

// Whether the Upload dialog is open, and where its files go by default. One per page, next to the
// page's `uploads` queue; the queue keeps running while the dialog is closed.
//   isOpen        whether to render the dialog
//   place         the place the dialog starts on (the page's own: General, a folder, a subject)
//   initialFiles  files dropped on the page, which the dialog starts with
//   open(place, files)  opens it. With uploads already in the queue, dropped files join them at once.
//   close()       closes it
// Rows that finished are dropped from the queue once the dialog is closed and nothing is still running,
// so the next time it opens it starts empty; failed rows stay until the student removes them.
export default function useUploadDialog(uploads) {
  const [state, setState] = useState(null); // { place, initialFiles } while open
  const { items, add, clearDone } = uploads;

  const open = useCallback(
    (place, files = []) => {
      const queued = items.length > 0;
      if (queued && files.length > 0) add(files, items.at(-1).place);
      setState({ place, initialFiles: queued ? [] : files });
    },
    [items, add],
  );
  const close = useCallback(() => setState(null), []);

  const closed = state === null;
  const finished = !items.some(isBusy) && items.some((item) => item.status === "done");
  useEffect(() => {
    if (closed && finished) clearDone();
  }, [closed, finished, clearDone]);

  return { isOpen: !closed, place: state?.place, initialFiles: state?.initialFiles ?? [], open, close };
}
