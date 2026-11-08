import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { filesText } from "./fileKinds";
import { placeOptions, placesText } from "./places";
import { isBusy } from "./useUploads";

// Whether the Upload dialog is open, and where its files go by default. One per page, next to the
// page's `uploads` queue and the library's `locations`; the queue keeps running while the dialog is closed.
//   isOpen        whether to render the dialog
//   place         the place the dialog starts on (the page's own: General, a folder, a subject)
//   initialFiles  files dropped on the page, which the dialog starts with
//   status        what the Upload buttons show: null when the queue is empty, { busy: true, done, total }
//                 while files are on their way, { failed } when only failures are left
//   open(place, files)  opens it. With uploads already in the queue, dropped files join them at once.
//   close()       closes it
// Rows that finished are dropped from the queue once the dialog is closed and nothing is still running,
// so the next time it opens it starts empty; failed rows stay until the student removes them.
// A batch that ends while the dialog is closed is announced with one toast.
export default function useUploadDialog(uploads, locations) {
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
  const busy = items.some(isBusy);
  const doneItems = items.filter((item) => item.status === "done");
  const failed = items.filter((item) => item.status === "failed").length;

  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy && closed && (doneItems.length > 0 || failed > 0)) {
      if (failed > 0) toast.error(`${filesText(failed)} didn't upload. Open Upload to try again.`);
      else toast.success(`Uploaded ${filesText(doneItems.length)} to ${placesText(doneItems, locations ? placeOptions(locations) : [])}.`);
    }
    wasBusy.current = busy;
  }, [busy, closed, doneItems, failed, locations]);

  const finished = !busy && doneItems.length > 0;
  useEffect(() => {
    if (closed && finished) clearDone();
  }, [closed, finished, clearDone]);

  const status = useMemo(() => {
    if (busy) return { busy: true, done: doneItems.length, total: items.length };
    return failed > 0 ? { failed } : null;
  }, [busy, doneItems.length, items.length, failed]);

  return { isOpen: !closed, place: state?.place, initialFiles: state?.initialFiles ?? [], status, open, close };
}
