// Arrow-key movement for a group of items (tabs, radios, menu rows). Returns the index to move
// to, or null when the key isn't a movement key. `current` is -1 when focus is outside the
// group. axis "vertical" ignores Left and Right (menus); "both" accepts all four arrows.
export function nextIndex(key, current, length, axis = "both") {
  if (length === 0) return null;
  const forward = axis === "vertical" ? ["ArrowDown"] : ["ArrowDown", "ArrowRight"];
  const back = axis === "vertical" ? ["ArrowUp"] : ["ArrowUp", "ArrowLeft"];
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (forward.includes(key)) return (current + 1) % length;
  if (back.includes(key)) return current <= 0 ? length - 1 : current - 1;
  return null;
}

// Keydown handler for tabs and radios: arrows, Home and End move focus and select (by clicking
// the target, so link tabs navigate and button tabs call their handler the normal way).
export function selectOnArrowKey(e, selector) {
  const items = [...e.currentTarget.querySelectorAll(selector)];
  const next = nextIndex(e.key, items.indexOf(document.activeElement), items.length);
  if (next === null) return;
  e.preventDefault();
  items[next].focus();
  items[next].click();
}
