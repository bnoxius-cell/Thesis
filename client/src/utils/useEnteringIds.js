import { useState } from "react";

// Which of these ids are new since the last render? A row that appears after the list was first
// shown (a task just added, or moved into this list) gets a short fade-in; rows present on first
// render never animate. Pass the ids of the rows on screen.
export default function useEnteringIds(ids) {
  const key = ids.join("|");
  const [seen, setSeen] = useState(() => new Set(ids));
  const [lastKey, setLastKey] = useState(key);
  const [entering, setEntering] = useState(() => new Set());
  if (key !== lastKey) {
    setLastKey(key);
    setEntering(new Set(ids.filter((id) => !seen.has(id))));
    setSeen(new Set(ids));
  }
  return entering;
}
