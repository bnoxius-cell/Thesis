import { FileImage, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { fileLabel } from "./fileRules";

// The icon for each label in fileRules; anything else is a plain document.
const ICONS = { PowerPoint: Presentation, Excel: FileSpreadsheet, Photo: FileImage };

// What a stored file is, from the `ext` the server detected from its bytes: { Icon, label }.
export function fileKind(ext) {
  const label = fileLabel(ext);
  return { Icon: ICONS[label] ?? FileText, label };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// "today", "yesterday", "3 days ago", "last week", "2 weeks ago", then the date.
export function addedText(createdAt, now = new Date()) {
  const created = new Date(createdAt);
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(created)) / DAY_MS));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "last week";
  if (weeks < 5) return `${weeks} weeks ago`;
  const sameYear = created.getFullYear() === now.getFullYear();
  return created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
}
