# Mobile rule

**Every change to structure or design must also be done for mobile view, in the same change.** A new page, section, dialog, button, layout tweak or style change isn't finished until it works on a phone. Don't leave the phone version for later.

Read this before any UI work in `client/`.

## What "done for mobile" means
- **Checked at 320px, 375px, 768px and 1280px wide**, in light and dark mode. 375px is the main phone size; 320px catches the tightest cases.
- **No horizontal scroll.** The page is never wider than the screen. Long words, links, codes and AI text wrap (`overflow-wrap: anywhere`, `minmax(0, 1fr)` grid columns).
- **Tap targets at least 44px** (buttons, icon buttons, menu items, checkboxes with their labels). Anything that works on hover also works on tap.
- **Fixed and sticky things clear the phone's edges**: use `env(safe-area-inset-*)` for anything pinned to the bottom or sides, so it stays above the iPhone home bar and out of the notch.
- **Dialogs fit**: `.modal-content` stays inside the screen, scrolls inside itself, and its buttons stay reachable.
- **Text stays readable**: nothing under about 13px, and contrast of 4.5:1 or better in both themes.
- **Nothing covers content for good**: a floating button (like the bottom-right Guide) must leave room to scroll past it (the footer gets extra bottom padding for it).

## Where the breakpoints are
All styling is plain CSS in `client/src/App.css` (Tailwind isn't wired up).
- `720px`: the main phone breakpoint. The sidebar becomes a 56px icon rail with a menu button, page padding drops to 16px, the Guide button turns into a round icon and its panel into a bottom sheet.
- `480px`, `640px`, `768px`: smaller per-component tweaks. Search `@media` in `App.css` near the component's own styles.
- Put a component's phone rules next to its desktop rules (same section of `App.css`), not in a far-away block.

## How to check
- In the owner's Chrome (Claude in Chrome extension): the resize tool doesn't work here, so load the page in a fixed-width iframe (`<iframe style="width:375px;height:740px">` pointing at the same origin) and look at it, or check computed widths with `document.documentElement.scrollWidth <= innerWidth`.
- Headless Chrome over CDP with `Emulation.setDeviceMetricsOverride` also works when the extension isn't connected (see `handout.md`, Gotchas).
- A real phone is still the final word for touch, the keyboard covering inputs, and iOS Safari quirks. Say so when it hasn't been tried.
