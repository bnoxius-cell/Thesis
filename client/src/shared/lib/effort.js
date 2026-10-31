// A task's size in one word, from the hours the student gave it.
export function effortLabel(hours) {
  const h = Number(hours) || 0;
  if (h <= 1.5) return "Small";
  if (h <= 4) return "Medium";
  return "Large";
}
