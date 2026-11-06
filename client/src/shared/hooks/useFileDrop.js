import { useState } from "react";

// Drag-and-drop for files onto an element. Spread `dropProps` on it; `over` is true while files are
// being dragged above it (drive the highlight from that). `onFiles` gets the dropped files as an
// array. Dragging text or a link over it does nothing, and nothing happens while `disabled`.
export default function useFileDrop({ onFiles, disabled = false }) {
  const [over, setOver] = useState(false);
  const carriesFiles = (event) => event.dataTransfer?.types?.includes("Files");

  const dropProps = {
    onDragOver(event) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      if (!disabled) setOver(true);
    },
    onDragLeave(event) {
      if (!event.currentTarget.contains(event.relatedTarget)) setOver(false);
    },
    onDrop(event) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setOver(false);
      if (!disabled) onFiles([...event.dataTransfer.files]);
    },
  };
  return { over, dropProps };
}
