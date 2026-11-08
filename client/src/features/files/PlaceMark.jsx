import { Folder, Layers } from "lucide-react";
import { subjectTone } from "@/shared/lib/subjectTone";
import { GENERAL } from "./places";
import "./files-hub.css";

// The small mark in front of a place's name: Layers for General, the subject's colour dot, Folder for a
// folder. `place` is "general", "subject:<id>" or "folder:<id>"; `color` is the subject's colour.
export default function PlaceMark({ place, color }) {
  if (place === GENERAL) return <Layers size={20} aria-hidden="true" />;
  if (place.startsWith("subject:")) return <span className={`files-dot files-dot--${subjectTone(color)}`} aria-hidden="true" />;
  return <Folder size={20} aria-hidden="true" />;
}
