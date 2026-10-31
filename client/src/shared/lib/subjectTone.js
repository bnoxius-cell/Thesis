// Subjects keep their eight stored colours, but the redrawn pages only use four tones.
// Each colour maps to the nearest one. Unknown or missing colours read as neutral.
const TONE = {
  blue: "accent",
  teal: "accent",
  violet: "accent",
  green: "good",
  olive: "good",
  amber: "watch",
  orange: "watch",
  slate: "neutral",
};

export const subjectTone = (color) => TONE[color] || "neutral";
