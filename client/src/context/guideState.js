import { createContext, useContext } from "react";

// The Guide's shared state (provided by GuideContext.jsx). Kept apart from the provider component so
// that file exports only a component, which Vite's fast refresh needs.
export const GuideState = createContext(null);

// Outside a provider (a test, a stray import) the Guide just reports "no tour".
const NONE = { tour: null, isOpen: false, setIsOpen() {}, register: () => () => {}, close() {}, toggle() {} };

export function useGuide() {
  return useContext(GuideState) || NONE;
}
