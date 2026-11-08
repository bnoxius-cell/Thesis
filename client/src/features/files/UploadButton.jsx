import { createPortal } from "react-dom";
import { AddButton, Button } from "@/shared/ui";

// What the button says while uploads are going on (or failed) after the dialog was closed. `status`
// comes from useUploadDialog; the round "+" has no room, so it keeps its look and only its name changes.
function statusLabel(status, round, fallback) {
  if (!status) return fallback;
  if (status.busy) return round ? `Upload, ${status.done} of ${status.total} uploading` : `Uploading ${status.done} of ${status.total}`;
  return round ? `Upload, ${status.failed} didn't upload` : `${status.failed} didn't upload`;
}

// The Upload button; it only asks the page to open the Upload dialog (`onClick`). The label can change
// for a second button on the same page ("Upload a file"). `status` swaps the label for the state of the
// uploads still in the queue (the dialog then opens on them). `floating` is the phone's pill above the
// bottom bar (Figma 157:1789); it is moved into the page body, so the tab's entrance animation can't
// carry it. `round` is the page header's "+", named by the label.
export default function UploadButton({ onClick, disabled = false, floating = false, round = false, status = null, children = "Upload" }) {
  const label = statusLabel(status, round, children);
  const button = round ? (
    <AddButton label={label} disabled={disabled} onClick={onClick} />
  ) : (
    <Button className={floating ? "files-upload--floating" : undefined} disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
  return floating ? createPortal(button, document.body) : button;
}
