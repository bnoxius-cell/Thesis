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

// On a phone /settings is the list, so the preferences area gets its own address there.
export const sectionPath = (key, phone = false) => {
  if (key !== "settings") return `/settings/${key}`;
  return phone ? "/settings/general" : "/settings";
};

// The section for the :section URL part, or undefined for an address that isn't one.
// "general" is the phone address of the preferences area; "settings" is only ever redirected.
export const sectionFor = (param) => {
  const key = param === "general" ? "settings" : (param ?? "settings");
  return SECTIONS.find((s) => s.key === key);
};
