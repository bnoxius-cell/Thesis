// Who a student can reach when things feel like too much. Shown only in Me > Help and more,
// never on a check-in result.
//
// PLACEHOLDERS: the owner fills in the `detail` lines. Do not invent numbers, offices or names.
// For the owner to verify before the panel (not shown on screen):
//   - NCMH Crisis Hotline: 1553 (24/7, English and Filipino)
//   - OLFU Guidance and Counseling Office: contact not found online
export const PLACEHOLDER_PREFIX = "[";

export const HELP_CONTACTS = [
  { name: "OLFU Guidance and Counseling Office", detail: "[Contact details to be added]" },
  { name: "Crisis line", detail: "[Contact details to be added]" },
];

export const isPlaceholder = (detail) => detail.trim().startsWith(PLACEHOLDER_PREFIX);
