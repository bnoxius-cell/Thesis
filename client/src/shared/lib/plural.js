// "1 task", "2 tasks".
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
