import { useState } from "react";
import "./avatar.css";

const SIZES = { md: 36, lg: 44, xl: 96 };

// A person's picture, or their first initial when there is none (or it fails to load).
// size: md (36) | lg (44) | xl (profile page). Decorative: the name sits next to it.
export default function Avatar({ name, src, size = "md", className = "" }) {
  const [broken, setBroken] = useState(false);
  const classes = `ui-avatar ui-avatar--${size} ${className}`.trim();
  const style = { "--avatar-size": `${SIZES[size]}px` };

  if (src && !broken) {
    return (
      <img
        className={classes}
        style={style}
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className={`${classes} ui-avatar--initial`} style={style} aria-hidden="true">
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}
