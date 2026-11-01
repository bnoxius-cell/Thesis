import { useState } from "react";

// A person's picture, or their initial when they have none (or it fails to load).
// `square` gives the softly rounded square used for group icons.
export default function UserAvatar({ name, src, size = 36, square = false, className = "" }) {
  const [broken, setBroken] = useState(false);
  const style = { "--ua-size": `${size}px` };
  const shape = square ? " ua-square" : "";

  if (src && !broken) {
    return (
      <img
        className={`ua${shape} ${className}`}
        style={style}
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className={`ua ua-fallback${shape} ${className}`} style={style} aria-hidden="true">
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}
