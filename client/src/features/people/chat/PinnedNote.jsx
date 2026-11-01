import { useState } from "react";
import { Pin } from "lucide-react";

const LONG_NOTE = 90; // about where two lines run out on a phone

// The group's pinned note, one soft bar at the top of the chat (Figma 64:302). Everyone reads it;
// changing it is on the group's Info dialog. A long note shows two lines until "More" is pressed.
export default function PinnedNote({ pinned }) {
  const [open, setOpen] = useState(false);
  if (!pinned?.text) return null;
  const long = pinned.text.length > LONG_NOTE;
  const by = pinned.by?.name ? `Pinned by ${pinned.by.name}: ` : "Pinned: ";

  return (
    <div className="people-pinned">
      <Pin size={20} aria-hidden="true" className="people-pinned__icon" />
      <p className={`people-pinned__text ${long && !open ? "is-clamped" : ""}`.trim()}>
        {by}
        {pinned.text}
      </p>
      {long && (
        <button type="button" className="people-pinned__more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}
