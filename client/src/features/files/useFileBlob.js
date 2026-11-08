import { useEffect, useState, useSyncExternalStore } from "react";
import { cachedFileBlob, fileBlobGeneration, loadFileBlob, subscribeFileBlobs } from "@/shared/lib/fileBlobs";

// A stored file's bytes for the viewer, through the Blob loader (which shares one fetch per file and
// keeps the last few in memory). Closing the viewer or switching file aborts a load nobody else waits
// for. When the loader is cleared (sign-out, or another account in another tab) the answer held here
// goes and the file loads again.
//   blob      the bytes, once they are here
//   loading   true until there is an answer
//   error     a message to show, when the load failed
//   code      UNSHOWABLE (utils/fileView) when the bytes came but can't be shown; trying again won't help
//   retry     asks again after an error, on a fresh link
export default function useFileBlob(file) {
  const { id, ext, size } = file;
  const generation = useSyncExternalStore(subscribeFileBlobs, fileBlobGeneration);
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState(null); // { key, ... }: the loader's answer for one file and attempt
  const key = `${id}:${attempt}:${generation}`;

  useEffect(() => {
    const controller = new AbortController();
    loadFileBlob({ id, ext, size }, { signal: controller.signal }).then((result) => {
      if (!result.aborted) setAnswer({ key, ...result });
    });
    return () => controller.abort();
  }, [id, ext, size, key]);

  const cached = cachedFileBlob(id);
  const current = answer?.key === key ? answer : null;
  return {
    blob: current?.blob ?? cached,
    loading: !current && !cached,
    error: current?.error ?? "",
    code: current?.code,
    retry: () => setAttempt((n) => n + 1),
  };
}
