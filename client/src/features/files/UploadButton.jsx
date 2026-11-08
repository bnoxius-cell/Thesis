import { createPortal } from "react-dom";
import { AddButton, Button } from "@/shared/ui";

// The Upload button; it only asks the page to open the Upload dialog (`onClick`). The label can change
// for a second button on the same page ("Upload a file"). `floating` is the phone's pill above the
// bottom bar (Figma 157:1789); it is moved into the page body, so the tab's entrance animation can't
// carry it. `round` is the page header's "+", named by the label.
export default function UploadButton({ onClick, disabled = false, floating = false, round = false, children = "Upload" }) {
  const button = round ? (
    <AddButton label={children} disabled={disabled} onClick={onClick} />
  ) : (
    <Button className={floating ? "files-upload--floating" : undefined} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
  return floating ? createPortal(button, document.body) : button;
}
