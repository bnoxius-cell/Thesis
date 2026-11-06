import useFileDrop from "@/shared/hooks/useFileDrop";

// The area where files can be dropped: it lights up while files are dragged over it, and hands them
// to `onFiles`. Nothing happens while `disabled` (uploads are off).
export default function FilesDrop({ onFiles, disabled, children }) {
  const { over, dropProps } = useFileDrop({ onFiles, disabled });
  return (
    <div {...dropProps} className={`files-drop${over ? " is-over" : ""}`}>
      {children}
    </div>
  );
}
