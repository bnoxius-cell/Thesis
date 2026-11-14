import { createPortal } from "react-dom";

// The page behind a tour step: dimmed everywhere except an undimmed rounded rectangle over the menu
// item being introduced, with no outline. The dim sits just under the tour window (the dialog overlay
// is 1000), and a see-through guard over the hole sits just above it, so a tap on the highlighted item
// does nothing instead of closing the tour. The hole slides between steps (guide.css).
export default function Spotlight({ hole }) {
  const style = { top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: hole.radius };
  return createPortal(
    <>
      <div className="tour-spotlight" style={style} aria-hidden="true" />
      <div className="tour-spotlight__guard" style={style} aria-hidden="true" />
    </>,
    document.body,
  );
}
