import FileRow from "./FileRow";

// The one list of files. Rows are keyed by file id, so the first-load stagger never replays when a
// row is added or removed. `freshIds` are files added in this visit and `leavingIds` files being
// deleted or moved out (see useLibrary). `placeName` (optional) says where a file lives, for the chip a
// row shows when the list mixes places (Recent and search results); a list of one place leaves it
// out. `movedId` is a file just moved, whose chip flashes.
export default function FileList({ files, freshIds, leavingIds, movedId, now, placeName, onOpen, onMove, onDelete, onGone }) {
  return (
    <ul className="files-list stagger">
      {files.map((file) => (
        <FileRow
          key={file.id}
          file={file}
          now={now}
          place={placeName?.(file)}
          moved={file.id === movedId}
          entering={freshIds.includes(file.id)}
          leaving={leavingIds.includes(file.id)}
          onOpen={onOpen}
          onMove={onMove}
          onDelete={onDelete}
          onGone={onGone}
        />
      ))}
    </ul>
  );
}
