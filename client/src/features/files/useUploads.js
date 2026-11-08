import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { uploadFile } from "@/shared/api/files";
import { MAX_PICK, extensionOf, fileProblem, isPhoto } from "./fileRules";
import makeThumb from "./makeThumb";
import { GENERAL } from "./places";

// An answer that means every other file in the queue would fail the same way, so they aren't sent.
const STOPS = new Set(["files_off", "files_paused", "storage_full", "quota_full", "daily_limit", "too_many_files"]);

// A 404 on an upload means its subject or folder is gone (deleted, or archived, maybe in another tab).
const PLACE_GONE = "The place this file was going to is gone. Retry saves it to General.";

// Still to be sent or being sent (a failed or finished row isn't).
export const isBusy = (item) => item.status === "queued" || item.status === "uploading";

let nextKey = 0;

// The uploads of one place, sent one after another (the server has two upload slots for everyone).
//   to          the place the files go when `add` isn't told one: "general" (the default), "subject:<id>"
//               or "folder:<id>"
//   onUploaded  gets each stored file (the list puts it first)
//   onSettled   runs once the queue is empty, to fetch the list again with the true usage
// `items` are the rows of the upload dialog: { key, name, ext, size, place, status, progress, error,
// retryable } with status "queued" | "uploading" | "done" | "failed". Cancelling a running upload aborts
// its request and takes its row away. Leaving the page cancels what is running and what is queued. The
// files themselves stay in a ref, not in state. `add(files, place)` sends that batch to `place`, so a
// batch keeps its place when the student moves to another folder view before it is sent.
// `rehome(place)` sends every file still waiting for `place` (queued, running or failed) to General
// instead: the page calls it when it deletes that folder, and a 404 does the same.
// Done rows stay in the list until `clearDone()` drops them (the dialog does when it closes).
export default function useUploads({ to, onUploaded, onSettled }) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  const files = useRef(new Map()); // key -> File
  const places = useRef(new Map()); // key -> the place it goes to
  const abort = useRef(new Map()); // key -> AbortController of the running upload
  const running = useRef(false);
  const mounted = useRef(true); // false once the page has gone: nothing new is sent after that
  const latest = useRef({});
  useEffect(() => {
    latest.current = { to, onUploaded, onSettled };
  });

  // Reads the latest list between awaits, which a state value captured earlier can't do.
  const update = useCallback((change) => {
    itemsRef.current = change(itemsRef.current);
    setItems(itemsRef.current);
  }, []);
  const patch = useCallback(
    (key, fields) => update((list) => list.map((item) => (item.key === key ? { ...item, ...fields } : item))),
    [update],
  );
  const drop = useCallback((key) => {
    files.current.delete(key);
    places.current.delete(key);
    update((list) => list.filter((item) => item.key !== key));
  }, [update]);

  const rehome = useCallback((place) => {
    places.current.forEach((target, key) => {
      if (target === place) places.current.set(key, GENERAL);
    });
    update((list) => list.map((item) => (item.place === place && places.current.has(item.key) ? { ...item, place: GENERAL } : item)));
  }, [update]);

  const send = useCallback(async (item) => {
    const file = files.current.get(item.key);
    const controller = new AbortController();
    abort.current.set(item.key, controller);
    patch(item.key, { status: "uploading", progress: 0, error: "" });

    const thumb = isPhoto(item.ext) ? await makeThumb(file) : null;
    const result = controller.signal.aborted || !mounted.current
      ? { cancelled: true }
      : await uploadFile(file, {
          to: places.current.get(item.key),
          thumb,
          signal: controller.signal,
          onProgress: (progress) => patch(item.key, { progress }),
        });
    abort.current.delete(item.key);

    if (result.cancelled) return null;
    if (result.error) {
      const place = places.current.get(item.key);
      const placeGone = result.status === 404 && place !== GENERAL;
      if (placeGone) rehome(place);
      patch(item.key, { status: "failed", error: placeGone ? PLACE_GONE : result.error, retryable: true });
      return result;
    }
    files.current.delete(item.key);
    places.current.delete(item.key);
    patch(item.key, { status: "done", progress: 1 });
    latest.current.onUploaded?.(result.data.file);
    return null;
  }, [patch, rehome]);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const nextQueued = () => mounted.current && itemsRef.current.find((item) => item.status === "queued");
    try {
      for (let next = nextQueued(); next; next = nextQueued()) {
        const failed = await send(next);
        if (STOPS.has(failed?.code)) {
          update((list) => list.map((item) => (item.status === "queued" ? { ...item, status: "failed", error: failed.error, retryable: true } : item)));
        }
      }
    } finally {
      running.current = false;
    }
    if (mounted.current) latest.current.onSettled?.();
  }, [send, update]);

  const add = useCallback((picked, place) => {
    if (picked.length > MAX_PICK) toast.error(`You can add up to ${MAX_PICK} files at a time.`);
    const target = place ?? latest.current.to ?? GENERAL;
    const added = picked.slice(0, MAX_PICK).map((file) => {
      const key = `upload-${nextKey++}`;
      const problem = fileProblem(file);
      if (!problem) {
        files.current.set(key, file);
        places.current.set(key, target);
      }
      return {
        key,
        name: file.name,
        ext: extensionOf(file.name),
        size: file.size,
        place: target,
        status: problem ? "failed" : "queued",
        progress: 0,
        error: problem,
        retryable: false,
      };
    });
    update((list) => [...list, ...added]);
    pump();
  }, [update, pump]);

  const retry = useCallback((key) => {
    patch(key, { status: "queued", error: "", progress: 0 });
    pump();
  }, [patch, pump]);

  const dismiss = useCallback((key) => {
    abort.current.get(key)?.abort();
    drop(key);
  }, [drop]);

  // Returns the same list when nothing is done, so a caller can run it in an effect without looping.
  const clearDone = useCallback(
    () => update((list) => (list.some((item) => item.status === "done") ? list.filter((item) => item.status !== "done") : list)),
    [update],
  );

  // Leaving the page (or this subject) stops the running upload and sends nothing still queued.
  useEffect(() => {
    mounted.current = true; // again after a development-mode remount
    const controllers = abort.current;
    return () => {
      mounted.current = false;
      controllers.forEach((controller) => controller.abort());
    };
  }, []);

  return { items, add, retry, dismiss, rehome, clearDone };
}
