import { useState } from "react";

// First letters of the first two words that start with a letter ("ITE 220 Study Circle" is "IS").
const initials = (name = "") => {
  const words = name.split(/\s+/).filter((word) => /^\p{L}/u.test(word));
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?";
};

// A group's icon or a person's picture, or their initials on a soft accent tint when there is none
// (or it fails to load). Size comes from the parent's --people-avatar. Decorative: the name sits next to it.
export default function PeopleAvatar({ name, src, className = "" }) {
  const [broken, setBroken] = useState(false);
  const classes = `people-avatar ${className}`.trim();
  if (src && !broken) {
    return <img className={classes} src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return (
    <span className={classes} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
