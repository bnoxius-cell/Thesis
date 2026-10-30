import "./skeleton.css";

// A calm pulsing block where content is on its way. Size it with `width` and `height` (any CSS
// length; the default is a full-width line of text); `circle` is for avatars. It is hidden from
// screen readers, so give the loading region its own status text.
export default function Skeleton({ width, height, circle = false, className = "" }) {
  return (
    <span
      className={`ui-skeleton ${circle ? "ui-skeleton--circle" : ""} ${className}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
