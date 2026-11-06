import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFiles } from "@/shared/api/files";

const INITIAL = { status: "loading", error: "", files: [], usage: null, uploads: null, freshIds: [], leavingIds: [] };

// The student's library files in one place, newest first.
//   where     "general", "subject:<id>" or "folder:<id>"; without it, every file
//   status    "loading" | "ready" | "failed"
//   error     a plain message for the failed state
//   files     the files ({ id, name, ext, size, hasThumb, createdAt, location, ... })
//   usage     { usedBytes, limitBytes }: everything the student has stored, not only these files
//   uploads   { on, code?, message?, resumesAt? }: whether uploading is open right now
//   freshIds  files added in this visit; their rows ease in
//   leavingIds files being deleted; their rows collapse, then `remove` takes them out
//   add       puts a file that has just been uploaded first
//   retire    starts a file's exit (the server has already deleted it)
//   remove    takes a file out of the list
//   refresh   fetches again in place; a failed fetch keeps what is on screen
//   reload    fetches again behind the loading state (Try again)
export default function useLibrary(where) {
  const [state, setState] = useState(INITIAL);
  const [loadedFor, setLoadedFor] = useState(where);
  const latest = useRef(0);

  if (loadedFor !== where) {
    setLoadedFor(where);
    setState(INITIAL);
  }

  const load = useCallback(async () => {
    const request = ++latest.current;
    const { data, error } = await fetchFiles(where);
    if (request !== latest.current) return; // a newer fetch is on its way, or the page is gone
    setState((prev) => {
      if (error) return prev.status === "ready" ? prev : { ...prev, status: "failed", error };
      return { ...prev, status: "ready", error: "", files: data.files, usage: data.usage, uploads: data.uploads };
    });
  }, [where]);

  useEffect(() => {
    load();
    return () => {
      latest.current += 1;
    };
  }, [load]);

  const reload = useCallback(() => {
    setState(INITIAL);
    load();
  }, [load]);

  const add = useCallback((file) => {
    setState((prev) => ({
      ...prev,
      files: [file, ...prev.files.filter((f) => f.id !== file.id)],
      freshIds: [...prev.freshIds, file.id],
      usage: prev.usage && { ...prev.usage, usedBytes: prev.usage.usedBytes + file.size },
    }));
  }, []);

  const retire = useCallback((id) => {
    setState((prev) => ({ ...prev, leavingIds: [...prev.leavingIds, id] }));
  }, []);

  const remove = useCallback((id) => {
    setState((prev) => {
      const gone = prev.files.find((f) => f.id === id);
      return {
        ...prev,
        files: prev.files.filter((f) => f.id !== id),
        leavingIds: prev.leavingIds.filter((leaving) => leaving !== id),
        usage: gone && prev.usage ? { ...prev.usage, usedBytes: Math.max(0, prev.usage.usedBytes - gone.size) } : prev.usage,
      };
    });
  }, []);

  return { ...state, add, retire, remove, refresh: load, reload };
}
