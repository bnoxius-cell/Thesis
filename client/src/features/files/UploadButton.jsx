import { createPortal } from "react-dom";
import { Button } from "@/shared/ui";

// What the button says while uploads are going on (or failed) after the dialog was closed. `status`
// comes from useUploadDialog.
function statusLabel(status, fallback) {
  if (!status) return fallback;
  if (status.busy) return `Uploading ${status.done} of ${status.total}`;
  return `${status.failed} didn't upload`;
}

// The Upload button; it only asks the page to open the Upload dialog (`onClick`). The label can change
// for a second button on the same page ("Upload a file"). `status` swaps the label for the state of the
// uploads still in the queue (the dialog then opens on them). `floating` is the phone's pill above the
// bottom bar (Figma 157:1789); it is moved into the page body, so the tab's entrance animation can't
// carry it. The header's own upload is the File row of the global Add.
export default function UploadButton({ onClick, disabled = false, floating = false, status = null, children = "Upload" }) {
  const button = (
    <Button className={floating ? "files-upload--floating" : undefined} disabled={disabled} onClick={onClick}>
      {statusLabel(status, children)}
    </Button>
  );
  return floating ? createPortal(button, document.body) : button;
}
