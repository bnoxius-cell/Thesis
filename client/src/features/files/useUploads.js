import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { uploadFile } from "@/shared/api/files";
import { MAX_PICK, extensionOf, fileProblem, isPhoto } from "./fileRules";
import makeThumb from "./makeThumb";

// An answer that means every other file in the queue would fail the same way, so they aren't sent.
const STOPS = new Set(["files_off", "files_paused", "storage_full", "quota_full", "daily_limit"]);

let nextKey = 0;

// The uploads of one place, sent one after another (the server has two upload slots for everyone).
//   to          the place the files go: "general", "subject:<id>" or "folder:<id>"
//   onUploaded  gets each stored file (the list puts it first)
//   onSettled   runs once the queue is empty, to fetch the list again with the true usage
// `items` are the rows of the upload tray: { key, name, status, progress, error, retryable } with
// status "queued" | "uploading" | "done" | "failed". Cancelling a running upload aborts its request
// and takes its row away. Leaving the page cancels what is running and what is queued. The files themselves
// stay in a ref, not in state.
export default function useUploads({ to, onUploaded, onSettled }) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  const files = useRef(new Map()); // key -> File
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
    update((list) => list.filter((item) => item.key !== key));
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
          to: latest.current.to,
          thumb,
          signal: controller.signal,
          onProgress: (progress) => patch(item.key, { progress }),
        });
    abort.current.delete(item.key);

    if (result.cancelled) return null;
    if (result.error) {
      patch(item.key, { status: "failed", error: result.error, retryable: true });
      return result;
    }
    files.current.delete(item.key);
    patch(item.key, { status: "done", progress: 1 });
    latest.current.onUploaded?.(result.data.file);
    return null;
  }, [patch]);

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

  const add = useCallback((picked) => {
    if (picked.length > MAX_PICK) toast.error(`You can add up to ${MAX_PICK} files at a time.`);
    const added = picked.slice(0, MAX_PICK).map((file) => {
      const key = `upload-${nextKey++}`;
      const problem = fileProblem(file);
      if (!problem) files.current.set(key, file);
      return { key, name: file.name, ext: extensionOf(file.name), status: problem ? "failed" : "queued", progress: 0, error: problem, retryable: false };
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

  // A finished batch clears itself a moment after its last file lands; failures stay until dismissed.
  const settled = items.length > 0 && items.every((item) => item.status === "done");
  useEffect(() => {
    if (!settled) return undefined;
    const timer = setTimeout(() => update(() => []), 3000);
    return () => clearTimeout(timer);
  }, [settled, update]);

  // Leaving the page (or this subject) stops the running upload and sends nothing still queued.
  useEffect(() => {
    mounted.current = true; // again after a development-mode remount
    const controllers = abort.current;
    return () => {
      mounted.current = false;
      controllers.forEach((controller) => controller.abort());
    };
  }, []);

  return { items, add, retry, dismiss };
}
