import { useEffect, useState } from "react";
import { cachedFileBlob, loadFileBlob } from "@/shared/lib/fileBlobs";

// A stored file's bytes for the viewer, through the Blob loader (which shares one fetch per file and
// keeps the last few in memory). Closing the viewer or switching file aborts a load nobody else waits
// for.
//   blob      the bytes, once they are here
//   loading   true until there is an answer
//   error     a message to show, when the load failed
//   fallback  true when this tab can't read the storage at all; Download still works
//   retry     asks again after an error
export default function useFileBlob(file) {
  const { id, ext, size } = file;
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState(null); // { key, ... }: the loader's answer for one file and attempt
  const key = `${id}:${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    loadFileBlob({ id, ext, size }, { signal: controller.signal }).then((result) => {
      if (!result.aborted) setAnswer({ key, ...result });
    });
    return () => controller.abort();
  }, [id, ext, size, key]);

  const cached = cachedFileBlob(id);
  const current = answer?.key === key ? answer : null;
  const blob = current?.blob ?? cached;
  return {
    blob,
    loading: !current && !cached,
    error: current?.error ?? "",
    fallback: Boolean(current?.fallback),
    retry: () => setAttempt((n) => n + 1),
  };
}
