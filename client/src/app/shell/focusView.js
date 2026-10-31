import { createContext, useContext, useEffect } from "react";

const noop = () => {};

// Whether any mounted screen currently asks for the focus view (a full-height screen such as the
// phone chat). While one does, the bottom bar hides. Outside the provider it does nothing.
export const FocusViewContext = createContext({ hidden: false, hold: noop });

export const useBottomBarHidden = () => useContext(FocusViewContext).hidden;

// Call from a screen that needs the whole phone height: useFocusView(true). The bar returns when
// `active` turns false or the component unmounts.
export function useFocusView(active) {
  const { hold } = useContext(FocusViewContext);
  useEffect(() => (active ? hold() : undefined), [active, hold]);
}
