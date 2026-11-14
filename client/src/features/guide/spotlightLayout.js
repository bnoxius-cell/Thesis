// Where the welcome tour's highlight and window go. The page's own menu items are measured, never
// copied: Sidebar and BottomBar mark their links and groups with data-tour-target and their frame
// (the whole sidebar or bar) with data-tour-frame, and only one of the two is on screen at a time.

const DESKTOP_HOLE = { pad: 6, radius: 12 }; // Figma 322:957 and its siblings
const PHONE_HOLE = { pad: 4, radius: 14 }; // Figma 316:390
const CARD_GAP = 32; // laptop: the window sits this far right of the sidebar
const CARD_EDGE = 24; // laptop: and keeps this far from the top and bottom of the screen
export const CARD_ABOVE_BAR = 16; // phone: the card floats this far above the bar

const visibleRect = (el) => {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
};

// The box around every visible element a step points at, plus the frame it lives in and the
// viewport size, as plain numbers so two measurements can be compared. Null when nothing is on screen
// (the bar is hidden in a focus view, or the layout has no such item).
export function measureTargets(keys) {
  const elements = keys.flatMap((key) => [...document.querySelectorAll(`[data-tour-target="${key}"]`)]);
  const found = elements.map((el) => ({ el, rect: visibleRect(el) })).filter((item) => item.rect);
  if (found.length === 0) return null;
  const rects = found.map((item) => item.rect);
  const box = {
    top: Math.min(...rects.map((r) => r.top)),
    left: Math.min(...rects.map((r) => r.left)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
  const frame = found[0].el.closest("[data-tour-frame]")?.getBoundingClientRect();
  return {
    ...box,
    frameTop: frame?.top ?? box.top,
    frameRight: frame?.right ?? box.right,
    vw: window.innerWidth,
    vh: window.innerHeight,
  };
}

export const sameMeasure = (a, b) => a === b || (a && b && Object.keys(a).every((key) => a[key] === b[key]));

// The undimmed rounded rectangle: the measured box with a little room around it.
export function holeFor(measure, phone) {
  const { pad, radius } = phone ? PHONE_HOLE : DESKTOP_HOLE;
  return {
    top: measure.top - pad,
    left: measure.left - pad,
    width: measure.right - measure.left + pad * 2,
    height: measure.bottom - measure.top + pad * 2,
    radius,
  };
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

// How far the window (laid out centred, or as a bottom sheet) must move so it sits beside the hole:
// right of the sidebar and centred on the hole on a laptop, centred above the bar on a phone.
// offsetLeft and offsetTop ignore transforms, so they are the window's own resting place.
export function cardOffset(card, measure, hole, phone) {
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  let left;
  let top;
  if (phone) {
    left = (measure.vw - width) / 2;
    top = clamp(measure.frameTop - CARD_ABOVE_BAR - height, CARD_ABOVE_BAR, measure.vh);
  } else {
    left = Math.min(measure.frameRight + CARD_GAP, measure.vw - width - CARD_EDGE);
    top = clamp(hole.top + hole.height / 2 - height / 2, CARD_EDGE, measure.vh - height - CARD_EDGE);
  }
  return { dx: left - card.offsetLeft, dy: top - card.offsetTop };
}
