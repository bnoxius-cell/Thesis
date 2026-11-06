import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { ensureLink } from "@/shared/lib/fileLinks";
import { isPhoto } from "./fileKinds";

// Opening a file. A photo opens in the preview dialog (`previewing` is that file); anything else
// asks for a link and navigates to it, which downloads it (the storage sends documents as an
// attachment, so the page stays). The link goes straight to `location.assign`: it is never kept,
// and nothing opens a window after the wait, where popup blockers would stop it.
export default function useOpenFile() {
  const [previewing, setPreviewing] = useState(null);

  const open = useCallback(async (file) => {
    if (isPhoto(file.ext)) {
      setPreviewing(file);
      return;
    }
    const { url, error } = await ensureLink(file.id, "file");
    if (error) toast.error(error);
    else window.location.assign(url);
  }, []);

  const closePreview = useCallback(() => setPreviewing(null), []);
  return { previewing, open, closePreview };
}
