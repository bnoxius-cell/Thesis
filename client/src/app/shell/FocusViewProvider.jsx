import { useCallback, useMemo, useState } from "react";
import { FocusViewContext } from "./focusView";

// Keeps the count behind useFocusView. `hold` raises it and returns the function that lowers it,
// so several screens can ask at once and the bar only returns when the last one lets go.
export default function FocusViewProvider({ children }) {
  const [holds, setHolds] = useState(0);

  const hold = useCallback(() => {
    setHolds((n) => n + 1);
    return () => setHolds((n) => n - 1);
  }, []);

  const value = useMemo(() => ({ hidden: holds > 0, hold }), [holds, hold]);
  return <FocusViewContext.Provider value={value}>{children}</FocusViewContext.Provider>;
}
