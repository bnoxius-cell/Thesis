import { FileImage, FileSpreadsheet, FileText, Presentation } from "lucide-react";

// What a stored file is, from the `ext` the server detected from its bytes.
const KINDS = {
  pdf: { Icon: FileText, label: "PDF" },
  docx: { Icon: FileText, label: "Word" },
  pptx: { Icon: Presentation, label: "PowerPoint" },
  xlsx: { Icon: FileSpreadsheet, label: "Excel" },
  png: { Icon: FileImage, label: "Photo" },
  jpg: { Icon: FileImage, label: "Photo" },
  jpeg: { Icon: FileImage, label: "Photo" },
  webp: { Icon: FileImage, label: "Photo" },
  txt: { Icon: FileText, label: "Text" },
  md: { Icon: FileText, label: "Text" },
};
const OTHER = { Icon: FileText, label: "File" };

export const fileKind = (ext) => KINDS[ext] ?? OTHER;
export const isPhoto = (ext) => fileKind(ext).Icon === FileImage;

// "890 KB", "2.1 MB", "100 MB": a whole number when the tenth would be zero.
export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = Math.ceil((bytes / (1024 * 1024)) * 10) / 10;
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
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
