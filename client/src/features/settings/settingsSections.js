import { Eye, Info, Settings, Users } from "lucide-react";

// The areas of /settings, in the order the frames show them (Help and What's new share the info icon). The first is the default (`/settings`).
// `dot` marks the one that can carry the "something new" dot.
export const SECTIONS = [
  { key: "settings", label: "Settings", icon: Settings },
  { key: "account", label: "Account", icon: Users },
  { key: "privacy", label: "Privacy", icon: Eye },
  { key: "help", label: "Help", icon: Info },
  { key: "whats-new", label: "What's new", icon: Info, dot: true },
];

export const sectionPath = (key) => (key === "settings" ? "/settings" : `/settings/${key}`);

// The section for the :section URL part, or undefined for an address that isn't one.
export const sectionFor = (param) => SECTIONS.find((s) => s.key === (param ?? "settings"));

