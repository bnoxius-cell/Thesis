import { useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/shared/ui";
import { FILE_ACCEPT } from "./fileRules";

// The Upload button: a real file input kept out of sight, opened by the button. `onFiles` gets the
// picked files as an array (the same hand-off a drop makes). The label can change for a second
// button on the same page ("Upload a file"). `floating` is the phone's pill above the bottom bar
// (Figma 157:1789); it is moved into the page body, so the tab's entrance animation can't carry it.
export default function UploadButton({ onFiles, disabled = false, floating = false, children = "Upload" }) {
  const inputRef = useRef(null);
  const button = (
    <Button className={floating ? "files-upload--floating" : undefined} disabled={disabled} onClick={() => inputRef.current.click()}>
      {children}
    </Button>
  );
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={FILE_ACCEPT}
        onChange={(event) => {
          onFiles([...event.target.files]);
          event.target.value = "";
        }}
      />
      {floating ? createPortal(button, document.body) : button}
    </>
  );
}
