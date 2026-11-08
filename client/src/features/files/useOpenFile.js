import { useCallback, useState } from "react";
import { isPhoto } from "./fileRules";

// Opening a file. A photo opens in the preview dialog (`previewing` is that file); anything else is
// handed to `download`, which saves it without leaving the page.
export default function useOpenFile(download) {
  const [previewing, setPreviewing] = useState(null);

  const open = (file) => {
    if (isPhoto(file.ext)) setPreviewing(file);
    else download(file);
  };

  const closePreview = useCallback(() => setPreviewing(null), []);
  return { previewing, open, closePreview };
}
