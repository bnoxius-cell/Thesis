const MARGIN = 8; // never closer than this to the viewport edge
const GAP = 4; // space between the trigger and the menu

// Where a fixed-position menu goes. Opens below the trigger unless it doesn't fit there and there
// is more room above, lines up with the trigger's start or end edge, and is clamped so it stays
// fully inside the viewport (a 320px phone included). All values are pixels.
export function computePlacement({ trigger, size, viewport, align = "start" }) {
  const width = Math.min(size.width, viewport.width - 2 * MARGIN);
  const roomBelow = viewport.height - trigger.bottom - GAP - MARGIN;
  const roomAbove = trigger.top - GAP - MARGIN;
  const openUp = size.height > roomBelow && roomAbove > roomBelow;
  const room = openUp ? roomAbove : roomBelow;
  const height = Math.min(size.height, room);

  const preferred = align === "end" ? trigger.right - width : trigger.left;
  const left = Math.max(MARGIN, Math.min(preferred, viewport.width - width - MARGIN));
  const top = openUp ? trigger.top - GAP - height : trigger.bottom + GAP;
  const anchorX = Math.min(Math.max(trigger.left + trigger.width / 2 - left, 0), width);

  return {
    top,
    left,
    maxHeight: Math.max(room, 96),
    origin: `${anchorX}px ${openUp ? "bottom" : "top"}`,
  };
}
