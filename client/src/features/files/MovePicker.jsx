import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Folder, FolderPlus, Layers, Search } from "lucide-react";
import { Modal } from "@/shared/ui";
import { computePlacement } from "@/shared/ui/menuPosition";
import { subjectTone } from "@/shared/lib/subjectTone";
import { GENERAL, placeOf } from "./places";
import "./files-hub.css";
import "./move-picker.css";

const NEW_FOLDER = "new-folder";

// Every choice in the order the picker shows them: New folder, General, the subjects, the folders.
// A search keeps the places whose name holds it (New folder always stays).
function buildOptions(locations, query) {
  const needle = query.trim().toLowerCase();
  const fits = (label) => !needle || label.toLowerCase().includes(needle);
  const subjects = locations.subjects
    .filter(({ name }) => fits(name))
    .map(({ id, name, color }) => ({
      value: `subject:${id}`,
      label: name,
      leading: <span className={`files-dot files-dot--${subjectTone(color)}`} aria-hidden="true" />,
    }));
  const folders = locations.folders
    .filter(({ name }) => fits(name))
    .map(({ id, name }) => ({ value: `folder:${id}`, label: name, leading: <Folder size={20} aria-hidden="true" /> }));
  return [
    { value: NEW_FOLDER, label: "New folder", leading: <FolderPlus size={20} aria-hidden="true" /> },
    ...(fits("General") ? [{ value: GENERAL, label: "General", leading: <Layers size={20} aria-hidden="true" /> }] : []),
    ...subjects.map((option) => ({ ...option, group: "Subjects" })),
    ...folders.map((option) => ({ ...option, group: "Folders" })),
  ];
}

// The search field and the places under it, as one combobox: focus stays in the field, the arrows move
// the highlighted place (aria-activedescendant), Enter picks it and Escape closes. The place the file
// is in now says "Current" with a check and can't be picked.
function PlaceList({ file, locations, onPick, onNewFolder, onClose }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState(null);
  const current = placeOf(file.location);
  const options = useMemo(() => buildOptions(locations, query), [locations, query]);
  const choices = options.filter((option) => option.value !== current);
  // Until the student arrows somewhere, the first real place is highlighted, so Enter moves the file;
  // New folder only when nothing else is left or it was picked with the arrows.
  const active =
    choices.find((option) => option.value === activeValue) ??
    choices.find((option) => option.value !== NEW_FOLDER) ??
    choices[0];
  const optionId = (option) => `${id}-${option.value}`;
  const activeId = active ? optionId(active) : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const pick = (option) => {
    if (option.value === NEW_FOLDER) onNewFolder();
    else if (option.value !== current) onPick(option.value, option.label);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!choices.length) return;
      const at = choices.indexOf(active);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveValue(choices[(at + step + choices.length) % choices.length].value);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active) pick(active);
    } else if (event.key === "Escape") {
      // Only the picker closes, never a dialog under it.
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  const row = (option) => {
    const isCurrent = option.value === current;
    return (
      <div
        key={option.value}
        id={optionId(option)}
        role="option"
        aria-selected={option === active}
        aria-disabled={isCurrent || undefined}
        className={`files-move__option${option === active ? " is-active" : ""}${isCurrent ? " is-current" : ""}`}
        onPointerDown={(event) => event.preventDefault()} // focus stays in the search field
        onPointerMove={() => !isCurrent && option !== active && setActiveValue(option.value)}
        onClick={() => pick(option)}
      >
        {option.leading}
        <span className="files-move__label">{option.label}</span>
        {isCurrent && (
          <span className="files-move__current">
            Current
            <Check size={18} aria-hidden="true" />
          </span>
        )}
      </div>
    );
  };

  const group = (name) => {
    const rows = options.filter((option) => option.group === name);
    if (!rows.length) return null;
    return (
      <div role="group" aria-labelledby={`${id}-${name}`}>
        <span id={`${id}-${name}`} className="sr-only">{name}</span>
        {rows.map(row)}
      </div>
    );
  };

  return (
    <>
      <div className="files-move__search">
        <Search size={18} aria-hidden="true" />
        <input
          type="text"
          role="combobox"
          aria-label="Search places"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          placeholder="Search places"
          autoComplete="off"
          enterKeyHint="go"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveValue(null);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <div id={`${id}-list`} role="listbox" aria-label="Places" className="files-move__list">
        {options.filter((option) => !option.group).map(row)}
        {group("Subjects")}
        {group("Folders")}
        {options.length === 1 && <p className="files-move__none">No places match.</p>}
      </div>
    </>
  );
}

// Desktop: a popover anchored to the row's More button (Figma 158:1610), placed like a Menu. A click
// outside, a page scroll or a resize closes it, and so does Tab.
function Popover({ anchor, label, onClose, children }) {
  const ref = useRef(null);
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  useLayoutEffect(() => {
    const box = ref.current;
    const place = computePlacement({
      trigger: anchor.getBoundingClientRect(),
      size: { width: box.offsetWidth, height: box.offsetHeight },
      viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
      align: "end",
    });
    Object.assign(box.style, {
      top: `${place.top}px`,
      left: `${place.left}px`,
      maxHeight: `${place.maxHeight}px`,
      transformOrigin: place.origin,
    });
    box.querySelector("input")?.focus({ preventScroll: true });
  }, [anchor]);

  useEffect(() => {
    const close = () => latestClose.current(false);
    // A press on the More button that opened it closes it and stops that click, so its menu doesn't
    // open as well. The click comes right after the press is released, so the stop is cleared then.
    const swallowClick = (event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    const onPointerDown = (event) => {
      if (ref.current.contains(event.target)) return;
      event.stopPropagation(); // a dialog overlay under it doesn't also close
      if (anchor.contains(event.target)) {
        anchor.addEventListener("click", swallowClick, true);
        window.addEventListener(
          "pointerup",
          () => setTimeout(() => anchor.removeEventListener("click", swallowClick, true)),
          { once: true },
        );
      }
      close();
    };
    const onScroll = (event) => {
      if (!ref.current.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [anchor]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="files-move files-move--popover"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        event.preventDefault(); // like a Menu: Tab leaves the picker, back on the More button
        onClose(true);
      }}
    >
      <p className="files-move__eyebrow" aria-hidden="true">Move to</p>
      {children}
    </div>,
    document.body,
  );
}

// Move to... for one file (Figma 158:1610 desktop, 158:1738 phone). Desktop shows a popover by the
// row's More button; a phone gets the same list in a bottom sheet. Picking a place calls
// `onPick(place, name)`; "New folder" calls `onNewFolder`. `onClose(restoreFocus)`: true when focus
// should go back to `anchor` (Escape), false for a click elsewhere. The sheet puts focus back itself.
export default function MovePicker({ file, anchor, locations, phone, onPick, onNewFolder, onClose }) {
  const list = (
    <PlaceList file={file} locations={locations} onPick={onPick} onNewFolder={onNewFolder} onClose={() => onClose(true)} />
  );

  if (phone) {
    return (
      <Modal sheet className="files-move-sheet" title="Move to" subtitle={file.name} onClose={() => onClose(false)}>
        {list}
      </Modal>
    );
  }
  return (
    <Popover anchor={anchor} label={`Move ${file.name}`} onClose={onClose}>
      {list}
    </Popover>
  );
}
