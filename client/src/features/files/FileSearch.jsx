import { Search, X } from "lucide-react";
import { IconButton } from "@/shared/ui";

// The Files page's search field (Figma 150:924). It only holds the text: the page filters the files
// it already has, so nothing is sent while typing. Escape or the clear button empties it.
export default function FileSearch({ value, onChange }) {
  return (
    <div className="files-search" role="search">
      <Search size={18} aria-hidden="true" className="files-search__icon" />
      <input
        type="search"
        className="files-search__input"
        aria-label="Search your files"
        placeholder="Search your files"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
      />
      {value && <IconButton plain icon={X} label="Clear search" onClick={() => onChange("")} />}
    </div>
  );
}
