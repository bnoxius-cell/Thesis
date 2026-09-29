import {
  BookOpen, FlaskConical, Calculator, Code, Dumbbell, Music, Palette, Coffee, Utensils,
  Moon, Briefcase, Users, Heart, Star, Laptop, Languages, Microscope, Bike, Gamepad2,
  Sparkles, Cat, PenTool,
} from "lucide-react";

// ---- Dates -----------------------------------------------------------------
// Everything is a local 'YYYY-MM-DD' string so a time zone can never shift an
// entry or holiday onto the neighbouring day. It matches what the server stores.

export const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const fromISODate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d, n) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};

// Weeks run Monday to Sunday.
export const startOfWeek = (d) => {
  const day = d.getDay();
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), day === 0 ? -6 : 1 - day);
};

export const formatTime = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const formatLongDate = (iso) =>
  fromISODate(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

// Display order for the day picker (Monday first). Values are Date#getDay numbers.
export const WEEKDAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
  { value: 0, short: "Sun", long: "Sunday" },
];

export const entryOccursOn = (entry, iso) => {
  if (entry.date) return entry.date === iso;
  if (!entry.days.includes(fromISODate(iso).getDay())) return false;
  if (entry.startDate && iso < entry.startDate) return false;
  if (entry.endDate && iso > entry.endDate) return false;
  return true;
};

// ---- Holidays --------------------------------------------------------------

// Combines the public holiday list with the schedule's own edits. An override always
// wins: 'workday' hides a public holiday, 'holiday' adds or renames one.
export const resolveHoliday = (iso, publicByDate, overrides) => {
  const override = overrides.find((o) => o.date === iso);
  const publicName = publicByDate[iso];
  if (override?.state === "workday") return null;
  if (override?.state === "holiday") {
    return { name: override.name || publicName || "Day off", source: publicName ? "edited" : "custom" };
  }
  if (publicName) return { name: publicName, source: "public" };
  return null;
};

// A small, common set. Nager.Date covers all of these.
export const COUNTRY_CODES = [
  "PH", "US", "GB", "CA", "AU", "NZ", "IE", "SG", "MY", "ID", "TH", "VN", "JP", "KR", "CN", "HK", "TW",
  "IN", "PK", "BD", "LK", "NP", "AE", "SA", "QA", "KW", "ZA", "NG", "KE", "EG", "DE", "FR", "ES", "IT",
  "PT", "NL", "BE", "CH", "AT", "SE", "NO", "DK", "FI", "PL", "GR", "TR", "BR", "MX", "AR", "CL", "CO", "PE",
];

let regionNames;
export const countryName = (code) => {
  try {
    regionNames ??= new Intl.DisplayNames(undefined, { type: "region" });
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
};

// ---- Themes ----------------------------------------------------------------

export const SCHEDULE_THEMES = [
  { key: "classic", label: "Classic", swatch: ["#dc2626", "#14213d", "#f1f5f9"] },
  { key: "cute", label: "Cute", swatch: ["#f472b6", "#a78bfa", "#fff1f7"] },
  { key: "ocean", label: "Ocean", swatch: ["#0ea5e9", "#14b8a6", "#ecfeff"] },
  { key: "matcha", label: "Matcha", swatch: ["#65a30d", "#ca8a04", "#f7fbe8"] },
  { key: "notebook", label: "Notebook", swatch: ["#2563eb", "#dc2626", "#fffdf5"] },
  { key: "midnight", label: "Midnight", swatch: ["#818cf8", "#f472b6", "#1e1b3a"] },
];

// ---- Entry look ------------------------------------------------------------

export const ENTRY_ICONS = {
  "book-open": BookOpen,
  "flask-conical": FlaskConical,
  calculator: Calculator,
  code: Code,
  laptop: Laptop,
  languages: Languages,
  microscope: Microscope,
  "pen-tool": PenTool,
  palette: Palette,
  music: Music,
  dumbbell: Dumbbell,
  bike: Bike,
  "gamepad-2": Gamepad2,
  coffee: Coffee,
  utensils: Utensils,
  moon: Moon,
  briefcase: Briefcase,
  users: Users,
  heart: Heart,
  star: Star,
  cat: Cat,
  sparkles: Sparkles,
};

// The fallback when nobody picked an icon or a picture.
export const defaultIconFor = (kind) => (
  kind === "activity" ? "sparkles" : kind === "exam" ? "pen-tool" : kind === "event" ? "star" : "book-open"
);

// What each kind of entry is called in forms and tags.
export const KIND_LABELS = { class: "Class", activity: "Activity", exam: "Exam", event: "Event" };

export const ENTRY_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e", "#14b8a6",
  "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#64748b",
];

// ---- Pictures --------------------------------------------------------------

const MAX_PICTURE_SIDE = 320;
// Stay comfortably under the server's 100kb cap on the encoded string.
const MAX_PICTURE_CHARS = 80 * 1024;

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file couldn't be read as an image.")); };
  img.src = url;
});

// Profile photos and group icons show up next to every message and in every member list,
// so they get a much smaller budget than a timetable picture: a cropped 128px square.
export const AVATAR_PICTURE = { side: 128, maxChars: 20 * 1024, square: true };

// Shrinks a picked photo to a small JPEG data URL that fits in the database.
// `square` crops the middle of the photo to a square first.
export const compressImage = async (file, { side = MAX_PICTURE_SIDE, maxChars = MAX_PICTURE_CHARS, square = false } = {}) => {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const img = await loadImage(file);
  const cropSide = Math.min(img.width, img.height);
  const sx = square ? (img.width - cropSide) / 2 : 0;
  const sy = square ? (img.height - cropSide) / 2 : 0;
  const sw = square ? cropSide : img.width;
  const sh = square ? cropSide : img.height;
  const scale = Math.min(1, side / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  // JPEG has no transparency, so a transparent PNG would otherwise turn black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  for (let quality = 0.8; quality >= 0.4; quality -= 0.1) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= maxChars) return dataUrl;
  }
  throw new Error("That picture is too detailed to shrink enough. Try a different one.");
};
