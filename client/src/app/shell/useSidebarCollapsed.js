import { useCallback, useState } from "react";

const KEY = "stresscare:sidebar-collapsed";

const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

// Whether the sidebar is the 72px icon rail. Remembered in this browser only; the page renders the
// same without storage.
export default function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(read);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(KEY, prev ? "0" : "1");
      } catch {
        // Private window or blocked storage: the choice just lasts for this visit.
      }
      return !prev;
    });
  }, []);

  return [collapsed, toggle];
}
