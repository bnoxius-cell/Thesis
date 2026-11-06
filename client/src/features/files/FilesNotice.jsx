// The quiet banner above the list when uploading is paused or the student's space is full
// (Figma 160:2121): a watch-tone strip with an icon and one plain sentence.
export default function FilesNotice({ icon: Icon, children }) {
  return (
    <p className="files-notice">
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}
