import { Link } from "react-router-dom";
import { Folder, Layers } from "lucide-react";
import { Card } from "@/shared/ui";
import { subjectTone } from "@/shared/lib/subjectTone";

const filesText = (n) => `${n} ${n === 1 ? "file" : "files"}`;

function Tile({ to, name, count, leading }) {
  return (
    <li>
      <Card as={Link} to={to} interactive className="files-tile">
        {leading}
        <span className="files-tile__text">
          <strong>{name}</strong>
          <span>{filesText(count)}</span>
        </span>
      </Card>
    </li>
  );
}

// PLACES (Figma 150:924, 154:1404, 160:3115): General (a layers stack), then each subject with its
// colour dot, then the custom folders, then a dashed "New folder". A subject opens its own Files tab (one home for a subject's
// files); General and a folder open their page. `counts` is files per place (see places.js).
export default function PlaceTiles({ locations, counts, onNewFolder }) {
  const folderIcon = <Folder size={20} aria-hidden="true" className="files-tile__icon" />;
  return (
    <ul className="files-tiles stagger">
      <Tile
        to="/study/files/general"
        name="General"
        count={counts.general ?? 0}
        leading={<Layers size={20} aria-hidden="true" className="files-tile__icon" />}
      />
      {locations.subjects.map(({ id, name, color }) => (
        <Tile
          key={id}
          to={`/study/subjects/${id}?tab=files`}
          name={name}
          count={counts[`subject:${id}`] ?? 0}
          leading={<span className={`files-dot files-dot--${subjectTone(color)}`} aria-hidden="true" />}
        />
      ))}
      {locations.folders.map(({ id, name }) => (
        <Tile key={id} to={`/study/files/folders/${id}`} name={name} count={counts[`folder:${id}`] ?? 0} leading={folderIcon} />
      ))}
      <li className="files-tiles__new">
        <button type="button" className="files-newtile" onClick={onNewFolder}>+ New folder</button>
      </li>
    </ul>
  );
}
