// Contrast check for the colour tokens, both themes. No browser needed: `npm run check:contrast`.
// Reads styles/tokens.css, resolves var() aliases, and checks the text and UI pairs below.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

const block = (selector) => {
  const start = css.indexOf(selector + ' {');
  const end = css.indexOf('\n  }', start);
  const tokens = {};
  for (const [, name, value] of css.slice(start, end).matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens[name] = value.trim();
  return tokens;
};

const light = block(':root');
const dark = { ...light, ...block('.dark-theme') };

const resolve = (tokens, name, depth = 0) => {
  const v = tokens[name];
  const alias = v?.match(/^var\(--([\w-]+)\)$/);
  return alias && depth < 8 ? resolve(tokens, alias[1], depth + 1) : v;
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum ratio]. 4.5 for text, 3 for UI edges and large pieces.
const pairs = [];
for (const bg of ['bg-app', 'surface', 'surface-2', 'surface-3']) {
  for (const fg of ['text-primary', 'text-secondary', 'text-muted']) pairs.push([fg, bg, 4.5]);
}
// Accent text sits on the page, cards and tinted rows; inputs sit on the page or a card.
for (const bg of ['bg-app', 'surface', 'surface-2']) pairs.push(['accent', bg, 4.5]);
for (const bg of ['bg-app', 'surface']) pairs.push(['border-input', bg, 3]);
pairs.push(
  ['on-accent', 'accent', 4.5], ['on-accent', 'accent-hover', 4.5], ['on-danger', 'danger', 4.5],
  ['accent', 'accent-soft', 4.5], ['good', 'good-soft', 4.5], ['watch', 'watch-soft', 4.5], ['danger', 'danger-soft', 4.5],
  ['text-primary', 'accent-soft', 4.5], ['sidebar-text', 'sidebar-bg', 4.5], ['sidebar-text-muted', 'sidebar-bg', 4.5],
  ['sidebar-active-text', 'sidebar-active-bg', 4.5], ['focus-ring', 'surface', 3], ['brand', 'surface', 3],
);
for (const c of ['blue', 'teal', 'green', 'olive', 'amber', 'orange', 'violet', 'slate']) {
  pairs.push([`subject-${c}`, 'surface', 3], ['text-primary', `subject-${c}-soft`, 4.5]);
}

let failed = 0;
for (const [name, tokens] of [['light', light], ['dark', dark]]) {
  for (const [fg, bg, min] of pairs) {
    const a = resolve(tokens, fg);
    const b = resolve(tokens, bg);
    if (!/^#[0-9a-f]{6}$/i.test(a ?? '') || !/^#[0-9a-f]{6}$/i.test(b ?? '')) continue;
    const r = ratio(a, b);
    if (r < min) {
      failed += 1;
      console.log(`${name}: ${fg} (${a}) on ${bg} (${b}) is ${r.toFixed(2)}, needs ${min}`);
    }
  }
}
console.log(failed ? `${failed} pair(s) below target` : 'All checked pairs pass in light and dark');
process.exitCode = failed ? 1 : 0;
