import FileRow from "./FileRow";

// The one list of files. Rows are keyed by file id, so the first-load stagger never replays when a
// row is added or removed. `freshIds` are files added in this visit and `leavingIds` files being
// deleted (see useLibrary).
export default function FileList({ files, freshIds, leavingIds, now, onOpen, onDelete, onGone }) {
  return (
    <ul className="files-list stagger">
      {files.map((file) => (
        <FileRow
          key={file.id}
          file={file}
          now={now}
          entering={freshIds.includes(file.id)}
          leaving={leavingIds.includes(file.id)}
          onOpen={onOpen}
          onDelete={onDelete}
          onGone={onGone}
        />
      ))}
    </ul>
  );
}
